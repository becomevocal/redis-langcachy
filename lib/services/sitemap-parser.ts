import { XMLParser } from "fast-xml-parser"

export interface SitemapUrl {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: number
}

export interface ParsedSitemap {
  urls: SitemapUrl[]
  sitemapIndexUrls?: string[]
}

export class SitemapParser {
  private parser: XMLParser

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    })
  }

  /**
   * Fetch and parse a sitemap from URL
   */
  async parseSitemap(sitemapUrl: string): Promise<ParsedSitemap> {
    try {
      const response = await fetch(sitemapUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SitemapBot/1.0)",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`)
      }

      const contentType = response.headers.get("content-type") || ""
      const xmlContent = await response.text()

      // Handle gzipped sitemaps
      if (contentType.includes("gzip") || sitemapUrl.endsWith(".gz")) {
        throw new Error(
          "Gzipped sitemaps not supported in browser environment. Please provide uncompressed sitemap URL.",
        )
      }

      return this.parseXml(xmlContent)
    } catch (error) {
      throw new Error(`Sitemap parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /**
   * Parse XML content into structured data
   */
  private parseXml(xmlContent: string): ParsedSitemap {
    const parsed = this.parser.parse(xmlContent)

    // Check if this is a sitemap index
    if (parsed.sitemapindex) {
      return this.parseSitemapIndex(parsed.sitemapindex)
    }

    // Parse regular sitemap
    if (parsed.urlset) {
      return this.parseUrlSet(parsed.urlset)
    }

    throw new Error("Invalid sitemap format: No urlset or sitemapindex found")
  }

  /**
   * Parse sitemap index (contains links to other sitemaps)
   */
  private parseSitemapIndex(sitemapindex: any): ParsedSitemap {
    const sitemaps = Array.isArray(sitemapindex.sitemap) ? sitemapindex.sitemap : [sitemapindex.sitemap]

    const sitemapIndexUrls = sitemaps.map((sitemap: any) => sitemap.loc).filter((loc: string) => loc)

    return {
      urls: [],
      sitemapIndexUrls,
    }
  }

  /**
   * Parse URL set (contains actual page URLs)
   */
  private parseUrlSet(urlset: any): ParsedSitemap {
    const urls = Array.isArray(urlset.url) ? urlset.url : [urlset.url]

    const parsedUrls: SitemapUrl[] = urls
      .filter((url: any) => url && url.loc)
      .map((url: any) => ({
        loc: url.loc,
        lastmod: url.lastmod,
        changefreq: url.changefreq,
        priority: url.priority ? Number.parseFloat(url.priority) : undefined,
      }))

    return {
      urls: parsedUrls,
    }
  }

  /**
   * Recursively parse sitemap index and all child sitemaps
   */
  async parseRecursive(sitemapUrl: string, maxDepth = 3, currentDepth = 0): Promise<SitemapUrl[]> {
    if (currentDepth >= maxDepth) {
      throw new Error("Maximum sitemap depth reached")
    }

    const parsed = await this.parseSitemap(sitemapUrl)

    // If this is a sitemap index, recursively parse child sitemaps
    if (parsed.sitemapIndexUrls && parsed.sitemapIndexUrls.length > 0) {
      const allUrls: SitemapUrl[] = []

      for (const childSitemapUrl of parsed.sitemapIndexUrls) {
        try {
          const childUrls = await this.parseRecursive(childSitemapUrl, maxDepth, currentDepth + 1)
          allUrls.push(...childUrls)
        } catch (error) {
          console.error(`Failed to parse child sitemap ${childSitemapUrl}:`, error)
        }
      }

      return allUrls
    }

    // Return URLs from regular sitemap
    return parsed.urls
  }

  /**
   * Validate sitemap URL format
   */
  static validateSitemapUrl(url: string): { valid: boolean; error?: string } {
    try {
      const urlObj = new URL(url)

      if (!["http:", "https:"].includes(urlObj.protocol)) {
        return { valid: false, error: "Sitemap URL must use HTTP or HTTPS protocol" }
      }

      if (!url.endsWith(".xml") && !url.includes("sitemap")) {
        return { valid: false, error: "URL should point to a sitemap file (typically .xml)" }
      }

      return { valid: true }
    } catch {
      return { valid: false, error: "Invalid URL format" }
    }
  }

  /**
   * Discover common sitemap locations
   */
  static getCommonSitemapUrls(domain: string): string[] {
    const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`
    const urlObj = new URL(baseUrl)
    const origin = urlObj.origin

    return [
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/sitemap-index.xml`,
      `${origin}/sitemap1.xml`,
      `${origin}/robots.txt`, // Can check robots.txt for sitemap location
    ]
  }
}
