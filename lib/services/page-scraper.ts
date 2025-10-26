import TurndownService from "turndown"
import { JSDOM } from "jsdom"
import { RedisService } from "./redis-service"
import type { PageContent } from "@/lib/redis"
import { hashUrl } from "@/lib/utils/hash"

export interface ScrapingOptions {
  timeout?: number
  retries?: number
  delayBetweenRequests?: number
  includeMetadata?: boolean
  cleanHtml?: boolean
}

export interface ScrapingResult {
  success: boolean
  url: string
  pageName: string
  markdown?: string
  contentLength?: number
  error?: string
}

export class PageScraper {
  private redisService: RedisService
  private turndownService: TurndownService

  constructor() {
    this.redisService = new RedisService()
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
   * Fetch and scrape a single page
   */
  async scrapePage(url: string, options: ScrapingOptions = {}): Promise<ScrapingResult> {
    const { timeout = 10000, retries = 3, cleanHtml = true, includeMetadata = true } = options

    let lastError: Error | null = null

    // Retry logic
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Fetch page content
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ContentBot/1.0)",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const html = await response.text()

        // Parse HTML and extract content
        const { markdown, pageName } = this.htmlToMarkdown(html, url, { cleanHtml, includeMetadata })

        return {
          success: true,
          url,
          pageName,
          markdown,
          contentLength: markdown.length,
        }
      } catch (error) {
        lastError = error as Error
        if (attempt < retries - 1) {
          // Wait before retry (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
        }
      }
    }

    return {
      success: false,
      url,
      pageName: "Unknown",
      error: lastError?.message || "Unknown error",
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
