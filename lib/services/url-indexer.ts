import { RedisService } from "./redis-service"
import { SitemapParser } from "./sitemap-parser"
import { hashUrl, extractDomain, generatePageName } from "@/lib/utils/hash"
import { findSitemapInRobots } from "@/lib/utils/robots-parser"
import type { UrlRecord, SitemapMetadata } from "@/lib/redis"

export interface IndexingOptions {
  maxUrls?: number
  skipExisting?: boolean
  batchSize?: number
}

export interface IndexingResult {
  success: boolean
  domain: string
  totalUrls: number
  indexedUrls: number
  skippedUrls: number
  errors: string[]
}

export class UrlIndexer {
  private redisService: RedisService
  private sitemapParser: SitemapParser

  constructor() {
    this.redisService = new RedisService()
    this.sitemapParser = new SitemapParser()
  }

  /**
   * Index all URLs from a sitemap into Redis
   */
  async indexSitemap(sitemapUrl: string, options: IndexingOptions = {}): Promise<IndexingResult> {
    const { maxUrls = 10000, skipExisting = true, batchSize = 50 } = options

    const domain = extractDomain(sitemapUrl)
    const errors: string[] = []
    let indexedUrls = 0
    let skippedUrls = 0

    try {
      // Update status to parsing
      await this.redisService.updateProcessingStatus({
        domain,
        status: "parsing",
        progress: { total: 0, completed: 0, failed: 0 },
        startedAt: new Date().toISOString(),
      })

      // Parse sitemap recursively
      const urls = await this.sitemapParser.parseRecursive(sitemapUrl)
      const totalUrls = Math.min(urls.length, maxUrls)

      // Store sitemap metadata
      const metadata: SitemapMetadata = {
        domain,
        sitemapUrl,
        totalUrls,
        processedUrls: 0,
        lastProcessed: new Date().toISOString(),
        status: "processing",
      }
      await this.redisService.storeSitemapMetadata(metadata)

      // Update status to indexing
      await this.redisService.updateProcessingStatus({
        domain,
        status: "indexing",
        progress: { total: totalUrls, completed: 0, failed: 0 },
        startedAt: new Date().toISOString(),
      })

      // Index URLs in batches
      const urlsToIndex = urls.slice(0, maxUrls)
      for (let i = 0; i < urlsToIndex.length; i += batchSize) {
        const batch = urlsToIndex.slice(i, i + batchSize)

        await Promise.all(
          batch.map(async (sitemapUrl) => {
            try {
              const urlHash = hashUrl(sitemapUrl.loc)

              // Check if URL already exists
              if (skipExisting) {
                const existing = await this.redisService.getUrlRecord(urlHash)
                if (existing) {
                  skippedUrls++
                  return
                }
              }

              // Create URL record
              const urlRecord: UrlRecord = {
                url: sitemapUrl.loc,
                urlHash,
                domain,
                pageName: generatePageName(sitemapUrl.loc),
                priority: sitemapUrl.priority,
                lastmod: sitemapUrl.lastmod,
                changefreq: sitemapUrl.changefreq,
                indexed: new Date().toISOString(),
                processed: false,
              }

              // Index URL
              await this.redisService.indexUrl(urlRecord)
              indexedUrls++
            } catch (error) {
              errors.push(
                `Failed to index ${sitemapUrl.loc}: ${error instanceof Error ? error.message : "Unknown error"}`,
              )
            }
          }),
        )

        // Update progress
        await this.redisService.updateProcessingStatus({
          domain,
          status: "indexing",
          progress: {
            total: totalUrls,
            completed: indexedUrls + skippedUrls,
            failed: errors.length,
          },
          startedAt: metadata.lastProcessed,
        })
      }

      // Update final metadata
      metadata.status = "completed"
      metadata.processedUrls = indexedUrls
      await this.redisService.storeSitemapMetadata(metadata)

      // Update final status
      await this.redisService.updateProcessingStatus({
        domain,
        status: "completed",
        progress: {
          total: totalUrls,
          completed: indexedUrls + skippedUrls,
          failed: errors.length,
        },
        startedAt: metadata.lastProcessed,
        completedAt: new Date().toISOString(),
      })

      return {
        success: true,
        domain,
        totalUrls,
        indexedUrls,
        skippedUrls,
        errors,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      errors.push(errorMessage)

      // Update error status
      await this.redisService.updateProcessingStatus({
        domain,
        status: "error",
        progress: { total: 0, completed: indexedUrls, failed: errors.length },
        error: errorMessage,
      })

      return {
        success: false,
        domain,
        totalUrls: 0,
        indexedUrls,
        skippedUrls,
        errors,
      }
    }
  }

  /**
   * Auto-discover and index sitemap from domain
   */
  async autoDiscoverAndIndex(domain: string, options: IndexingOptions = {}): Promise<IndexingResult> {
    // Try to find sitemap in robots.txt
    const robotsSitemaps = await findSitemapInRobots(domain)
    if (robotsSitemaps.length > 0) {
      return await this.indexSitemap(robotsSitemaps[0], options)
    }

    // Try common sitemap locations
    const commonUrls = SitemapParser.getCommonSitemapUrls(domain)
    for (const url of commonUrls) {
      try {
        const validation = SitemapParser.validateSitemapUrl(url)
        if (!validation.valid) continue

        // Try to fetch and parse
        const result = await this.indexSitemap(url, options)
        if (result.success) {
          return result
        }
      } catch {
        // Continue to next URL
        continue
      }
    }

    return {
      success: false,
      domain: extractDomain(domain),
      totalUrls: 0,
      indexedUrls: 0,
      skippedUrls: 0,
      errors: ["Could not find or parse sitemap"],
    }
  }

  /**
   * Re-index existing URLs (useful for updates)
   */
  async reindexDomain(domain: string, options: IndexingOptions = {}): Promise<IndexingResult> {
    // Get existing sitemap metadata
    const metadata = await this.redisService.getSitemapMetadata(domain)
    if (!metadata) {
      return {
        success: false,
        domain,
        totalUrls: 0,
        indexedUrls: 0,
        skippedUrls: 0,
        errors: ["No existing sitemap metadata found"],
      }
    }

    // Delete existing data
    await this.redisService.deleteDomainData(domain)

    // Re-index from original sitemap URL
    return await this.indexSitemap(metadata.sitemapUrl, { ...options, skipExisting: false })
  }

  /**
   * Get indexing statistics for a domain
   */
  async getIndexingStats(domain: string) {
    const metadata = await this.redisService.getSitemapMetadata(domain)
    const status = await this.redisService.getProcessingStatus(domain)
    const urlCount = await this.redisService.getUrlCount(domain)

    return {
      metadata,
      status,
      urlCount,
    }
  }
}
