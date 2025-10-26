import TurndownService from "turndown"
import { JSDOM } from "jsdom"
import { RedisService } from "./redis-service"
import { LangCacheService } from "./langcache-service"
import type { PageContent } from "@/lib/redis"
import { hashUrl } from "@/lib/utils/hash"

export interface ScrapingOptions {
  timeout?: number
  retries?: number
  delayBetweenRequests?: number
  includeMetadata?: boolean
  cleanHtml?: boolean
  useJinaReader?: boolean // Use Jina AI Reader API as primary method
  useBrowser?: boolean // Use headless browser for JS-heavy sites
}

export interface ScrapingResult {
  success: boolean
  url: string
  pageName: string
  markdown?: string
  contentLength?: number
  error?: string
  method?: "jina" | "browser" | "fetch" // Which method was used
}

export class PageScraper {
  private redisService: RedisService
  private turndownService: TurndownService
  private langCacheService: LangCacheService

  constructor() {
    this.redisService = new RedisService()
    this.langCacheService = new LangCacheService()
    this.turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
    })

    // Configure Turndown rules for better markdown conversion
    this.configureTurndown()
  }

  /**
   * Configure Turndown service with custom rules
   */
  private configureTurndown() {
    // Remove script and style tags
    this.turndownService.remove(["script", "style", "noscript", "iframe"])

    // Keep links with their URLs
    this.turndownService.addRule("links", {
      filter: "a",
      replacement: (content, node) => {
        const href = (node as HTMLAnchorElement).getAttribute("href")
        if (!href || href.startsWith("#")) return content
        return `[${content}](${href})`
      },
    })

    // Handle images
    this.turndownService.addRule("images", {
      filter: "img",
      replacement: (content, node) => {
        const alt = (node as HTMLImageElement).getAttribute("alt") || ""
        const src = (node as HTMLImageElement).getAttribute("src") || ""
        return src ? `![${alt}](${src})` : ""
      },
    })

    // Handle code blocks
    this.turndownService.addRule("codeBlocks", {
      filter: ["pre"],
      replacement: (content, node) => {
        const code = (node as HTMLElement).textContent || ""
        return `\n\`\`\`\n${code}\n\`\`\`\n`
      },
    })
  }

  /**
   * Scrape using Jina AI Reader API (bypasses most anti-bot protection)
   */
  private async scrapeWithJina(url: string): Promise<ScrapingResult> {
    try {
      console.log("[v0] Attempting to scrape with Jina AI Reader:", url)

      // Jina AI Reader converts any URL to markdown
      const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`

      const response = await fetch(jinaUrl, {
        headers: {
          Accept: "text/markdown",
          "X-Return-Format": "markdown",
        },
      })

      if (!response.ok) {
        throw new Error(`Jina API returned ${response.status}`)
      }

      const markdown = await response.text()

      // Extract page name from first heading or use URL
      const firstHeading = markdown.match(/^#\s+(.+)$/m)
      const pageName = firstHeading ? firstHeading[1] : new URL(url).pathname.split("/").pop() || "Untitled"

      console.log("[v0] Successfully scraped with Jina:", url)

      return {
        success: true,
        url,
        pageName,
        markdown,
        contentLength: markdown.length,
        method: "jina",
      }
    } catch (error) {
      console.error("[v0] Jina scraping failed:", error)
      return {
        success: false,
        url,
        pageName: "Unknown",
        error: `Jina scraping failed: ${(error as Error).message}`,
        method: "jina",
      }
    }
  }

  /**
   * Scrape using headless browser (Playwright) for JS-heavy sites
   */
  private async scrapeWithBrowser(url: string, timeout = 30000): Promise<ScrapingResult> {
    try {
      console.log("[v0] Attempting to scrape with headless browser:", url)

      // Dynamic import of playwright
      const { chromium } = await import("playwright")

      const browser = await chromium.launch({
        headless: true,
      })

      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1920, height: 1080 },
        locale: "en-US",
      })

      const page = await context.newPage()

      // Navigate to page
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout,
      })

      // Wait for content to load
      await page.waitForLoadState("domcontentloaded")

      // Extract content
      const content = await page.evaluate(() => {
        const title = document.title
        const main = document.querySelector("main") || document.querySelector("article") || document.body

        // Remove unwanted elements
        const unwanted = main?.querySelectorAll(
          "script, style, noscript, iframe, nav, header, footer, .advertisement, .ads",
        )
        unwanted?.forEach((el) => el.remove())

        return {
          title,
          html: main?.innerHTML || "",
        }
      })

      await browser.close()

      // Convert HTML to markdown
      const markdown = this.turndownService.turndown(content.html)
      const cleanMarkdown = markdown.replace(/\n{3,}/g, "\n\n").trim()

      console.log("[v0] Successfully scraped with browser:", url)

      return {
        success: true,
        url,
        pageName: content.title || "Untitled",
        markdown: `# ${content.title}\n\n**URL:** ${url}\n\n${cleanMarkdown}`,
        contentLength: cleanMarkdown.length,
        method: "browser",
      }
    } catch (error) {
      console.error("[v0] Browser scraping failed:", error)
      return {
        success: false,
        url,
        pageName: "Unknown",
        error: `Browser scraping failed: ${(error as Error).message}`,
        method: "browser",
      }
    }
  }

  /**
   * Fetch and scrape a single page with multiple strategies
   */
  async scrapePage(url: string, options: ScrapingOptions = {}): Promise<ScrapingResult> {
    const {
      timeout = 10000,
      retries = 3,
      cleanHtml = true,
      includeMetadata = true,
      useJinaReader = true, // Default to Jina for best anti-bot protection
      useBrowser = false,
    } = options

    console.log("[v0] Starting scrape for:", url)

    // Strategy 1: Try Jina AI Reader first (best for anti-bot)
    if (useJinaReader) {
      const jinaResult = await this.scrapeWithJina(url)
      if (jinaResult.success) {
        return jinaResult
      }
      console.log("[v0] Jina failed, trying next method...")
    }

    // Strategy 2: Try headless browser if requested
    if (useBrowser) {
      const browserResult = await this.scrapeWithBrowser(url, timeout)
      if (browserResult.success) {
        return browserResult
      }
      console.log("[v0] Browser scraping failed, trying basic fetch...")
    }

    // Strategy 3: Fallback to basic fetch with better headers
    let lastError: Error | null = null

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(`[v0] Fetch attempt ${attempt + 1}/${retries} for:`, url)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            Connection: "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Cache-Control": "max-age=0",
          },
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const html = await response.text()

        // Parse HTML and extract content
        const { markdown, pageName } = this.htmlToMarkdown(html, url, { cleanHtml, includeMetadata })

        console.log("[v0] Successfully scraped with fetch:", url)

        return {
          success: true,
          url,
          pageName,
          markdown,
          contentLength: markdown.length,
          method: "fetch",
        }
      } catch (error) {
        lastError = error as Error
        console.error(`[v0] Fetch attempt ${attempt + 1} failed:`, lastError.message)

        if (attempt < retries - 1) {
          // Wait before retry (exponential backoff)
          const delay = 1000 * Math.pow(2, attempt)
          console.log(`[v0] Waiting ${delay}ms before retry...`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    console.error("[v0] All scraping methods failed for:", url)

    return {
      success: false,
      url,
      pageName: "Unknown",
      error: lastError?.message || "All scraping methods failed",
      method: "fetch",
    }
  }

  /**
   * Convert HTML to Markdown
   */
  private htmlToMarkdown(
    html: string,
    url: string,
    options: { cleanHtml?: boolean; includeMetadata?: boolean } = {},
  ): { markdown: string; pageName: string } {
    const { cleanHtml = true, includeMetadata = true } = options

    // Parse HTML with JSDOM
    const dom = new JSDOM(html)
    const document = dom.window.document

    // Extract page title
    const pageName = document.querySelector("title")?.textContent?.trim() || "Untitled Page"

    // Extract main content
    const contentElement = document.querySelector("main") || document.querySelector("article") || document.body

    if (cleanHtml) {
      // Remove unwanted elements
      const unwantedSelectors = [
        "script",
        "style",
        "noscript",
        "iframe",
        "nav",
        "header",
        "footer",
        ".advertisement",
        ".ads",
        "#cookie-banner",
        ".cookie-notice",
      ]

      unwantedSelectors.forEach((selector) => {
        contentElement?.querySelectorAll(selector).forEach((el) => el.remove())
      })
    }

    // Convert to markdown
    let markdown = this.turndownService.turndown(contentElement?.innerHTML || "")

    // Add metadata if requested
    if (includeMetadata) {
      const metadata = this.extractMetadata(document)
      const metadataSection = this.formatMetadata(pageName, url, metadata)
      markdown = `${metadataSection}\n\n${markdown}`
    }

    // Clean up excessive whitespace
    markdown = markdown
      .replace(/\n{3,}/g, "\n\n") // Max 2 consecutive newlines
      .trim()

    return { markdown, pageName }
  }

  /**
   * Extract metadata from HTML document
   */
  private extractMetadata(document: Document): Record<string, string> {
    const metadata: Record<string, string> = {}

    // Extract meta description
    const description = document.querySelector('meta[name="description"]')?.getAttribute("content")
    if (description) metadata.description = description

    // Extract Open Graph data
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content")
    if (ogTitle) metadata.ogTitle = ogTitle

    const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute("content")
    if (ogDescription) metadata.ogDescription = ogDescription

    // Extract keywords
    const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute("content")
    if (keywords) metadata.keywords = keywords

    return metadata
  }

  /**
   * Format metadata as markdown
   */
  private formatMetadata(pageName: string, url: string, metadata: Record<string, string>): string {
    let formatted = `# ${pageName}\n\n**URL:** ${url}\n`

    if (metadata.description) {
      formatted += `\n**Description:** ${metadata.description}\n`
    }

    if (metadata.keywords) {
      formatted += `\n**Keywords:** ${metadata.keywords}\n`
    }

    return formatted
  }

  /**
   * Scrape and cache a page
   */
  async scrapeAndCache(url: string, options: ScrapingOptions = {}): Promise<ScrapingResult> {
    const urlHash = hashUrl(url)

    // Check if content is already cached
    const cached = await this.redisService.getPageContent(urlHash)
    if (cached) {
      await this.langCacheService.indexPageContent(cached)
      return {
        success: true,
        url: cached.url,
        pageName: cached.pageName,
        markdown: cached.markdown,
        contentLength: cached.contentLength,
      }
    }

    // Scrape page
    const result = await this.scrapePage(url, options)

    // Cache successful results
    if (result.success && result.markdown) {
      const pageContent: PageContent = {
        url,
        pageName: result.pageName,
        markdown: result.markdown,
        fetchedAt: new Date().toISOString(),
        contentLength: result.contentLength || 0,
      }

      await this.redisService.storePageContent(urlHash, pageContent)
      await this.langCacheService.indexPageContent(pageContent)
    }

    return result
  }

  /**
   * Scrape multiple pages with rate limiting
   */
  async scrapeMultiple(
    urls: string[],
    options: ScrapingOptions = {},
  ): Promise<{ results: ScrapingResult[]; summary: { success: number; failed: number } }> {
    const { delayBetweenRequests = 1000 } = options
    const results: ScrapingResult[] = []
    let successCount = 0
    let failedCount = 0

    for (const url of urls) {
      const result = await this.scrapeAndCache(url, options)
      results.push(result)

      if (result.success) {
        successCount++
      } else {
        failedCount++
      }

      // Mark URL as processed in Redis
      const urlHash = hashUrl(url)
      await this.redisService.markUrlProcessed(urlHash, result.success, result.error)

      // Rate limiting delay
      if (delayBetweenRequests > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenRequests))
      }
    }

    return {
      results,
      summary: {
        success: successCount,
        failed: failedCount,
      },
    }
  }
}
