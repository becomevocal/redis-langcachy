import { UrlIndexer } from "./url-indexer"
import { PageScraper } from "./page-scraper"
import { AIProcessor } from "./ai-processor"
import { RedisService } from "./redis-service"

export interface PipelineOptions {
  maxUrls?: number
  scrapeDelay?: number
  aiDelay?: number
  aiModel?: string
  aiTemperature?: number
}

export interface PipelineResult {
  success: boolean
  domain: string
  stages: {
    indexing: {
      totalUrls: number
      indexedUrls: number
      skippedUrls: number
    }
    scraping: {
      attempted: number
      successful: number
      failed: number
    }
    aiProcessing: {
      attempted: number
      successful: number
      cached: number
      failed: number
    }
  }
  totalTime: number
  errors: string[]
}

/**
 * Complete processing pipeline: Index → Scrape → AI Process → Cache
 */
export class ProcessingPipeline {
  private indexer: UrlIndexer
  private scraper: PageScraper
  private aiProcessor: AIProcessor
  private redisService: RedisService

  constructor() {
    this.indexer = new UrlIndexer()
    this.scraper = new PageScraper()
    this.aiProcessor = new AIProcessor()
    this.redisService = new RedisService()
  }

  /**
   * Run complete pipeline for a sitemap
   */
  async run(sitemapUrl: string, options: PipelineOptions = {}): Promise<PipelineResult> {
    const {
      maxUrls = 50,
      scrapeDelay = 1000,
      aiDelay = 2000,
      aiModel = "openai/gpt-4o-mini",
      aiTemperature = 0.7,
    } = options

    const startTime = Date.now()
    const errors: string[] = []

    try {
      // Stage 1: Index sitemap
      console.log("[v0] Pipeline Stage 1: Indexing sitemap...")
      const indexResult = await this.indexer.indexSitemap(sitemapUrl, {
        maxUrls,
        skipExisting: false,
        batchSize: 20,
      })

      if (!indexResult.success) {
        errors.push(...indexResult.errors)
        throw new Error("Indexing failed")
      }

      const domain = indexResult.domain

      // Stage 2: Scrape pages
      console.log("[v0] Pipeline Stage 2: Scraping pages...")
      const urlRecords = await this.redisService.getUrlsByDomain(domain, maxUrls)
      const urls = urlRecords.map((record) => record.url)

      const scrapeResult = await this.scraper.scrapeMultiple(urls, {
        timeout: 10000,
        retries: 2,
        delayBetweenRequests: scrapeDelay,
        cleanHtml: true,
        includeMetadata: true,
      })

      // Stage 3: AI Processing with caching
      console.log("[v0] Pipeline Stage 3: AI processing with caching...")
      const aiResult = await this.aiProcessor.processDomain(domain, {
        model: aiModel,
        temperature: aiTemperature,
        maxTokens: 2000,
        delayBetweenRequests: aiDelay,
      })

      const totalTime = Date.now() - startTime

      return {
        success: true,
        domain,
        stages: {
          indexing: {
            totalUrls: indexResult.totalUrls,
            indexedUrls: indexResult.indexedUrls,
            skippedUrls: indexResult.skippedUrls,
          },
          scraping: {
            attempted: urls.length,
            successful: scrapeResult.summary.success,
            failed: scrapeResult.summary.failed,
          },
          aiProcessing: {
            attempted: aiResult.summary.total,
            successful: aiResult.summary.successful,
            cached: aiResult.summary.cached,
            failed: aiResult.summary.failed,
          },
        },
        totalTime,
        errors,
      }
    } catch (error) {
      const totalTime = Date.now() - startTime
      errors.push(error instanceof Error ? error.message : "Unknown error")

      return {
        success: false,
        domain: "",
        stages: {
          indexing: { totalUrls: 0, indexedUrls: 0, skippedUrls: 0 },
          scraping: { attempted: 0, successful: 0, failed: 0 },
          aiProcessing: { attempted: 0, successful: 0, cached: 0, failed: 0 },
        },
        totalTime,
        errors,
      }
    }
  }
}
