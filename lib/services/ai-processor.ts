import { generateText } from "ai"
import { LangCacheService } from "./langcache-service"
import { RedisService } from "./redis-service"

export interface AIProcessingOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  delayBetweenRequests?: number
}

export interface AIProcessingResult {
  url: string
  success: boolean
  response?: string
  fromCache?: boolean
  processingTime?: number
  error?: string
}

export class AIProcessor {
  private langCacheService: LangCacheService
  private redisService: RedisService

  constructor() {
    this.langCacheService = new LangCacheService()
    this.redisService = new RedisService()
  }

  /**
   * Process a single URL with AI
   */
  async processUrl(url: string, options: AIProcessingOptions = {}): Promise<AIProcessingResult> {
    const { model = "openai/gpt-4o-mini", temperature = 0.7, maxTokens = 2000 } = options

    const startTime = Date.now()

    try {
      const result = await this.langCacheService.processWithAI(url, async (prompt) => {
        const { text } = await generateText({
          model,
          prompt,
          temperature,
          maxTokens,
        })
        return text
      })

      const processingTime = Date.now() - startTime

      return {
        url,
        success: result.success,
        response: result.response,
        fromCache: result.fromCache,
        processingTime,
        error: result.error,
      }
    } catch (error) {
      return {
        url,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processingTime: Date.now() - startTime,
      }
    }
  }

  /**
   * Process all URLs for a domain
   */
  async processDomain(
    domain: string,
    options: AIProcessingOptions = {},
  ): Promise<{
    results: AIProcessingResult[]
    summary: {
      total: number
      successful: number
      failed: number
      cached: number
      totalTime: number
    }
  }> {
    const { delayBetweenRequests = 2000 } = options

    const startTime = Date.now()

    // Get all URLs for the domain
    const urlRecords = await this.redisService.getUrlsByDomain(domain, 1000)
    const results: AIProcessingResult[] = []

    let successful = 0
    let failed = 0
    let cached = 0

    // Update processing status
    await this.redisService.updateProcessingStatus({
      domain,
      status: "scraping",
      progress: {
        total: urlRecords.length,
        completed: 0,
        failed: 0,
      },
      startedAt: new Date().toISOString(),
    })

    // Process each URL
    for (let i = 0; i < urlRecords.length; i++) {
      const urlRecord = urlRecords[i]
      const result = await this.processUrl(urlRecord.url, options)

      results.push(result)

      if (result.success) {
        successful++
        if (result.fromCache) cached++
      } else {
        failed++
      }

      // Update progress
      await this.redisService.updateProcessingStatus({
        domain,
        status: "scraping",
        currentUrl: urlRecord.url,
        progress: {
          total: urlRecords.length,
          completed: i + 1,
          failed,
        },
        startedAt: new Date(startTime).toISOString(),
      })

      // Rate limiting
      if (delayBetweenRequests > 0 && i < urlRecords.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenRequests))
      }
    }

    const totalTime = Date.now() - startTime

    // Update final status
    await this.redisService.updateProcessingStatus({
      domain,
      status: "completed",
      progress: {
        total: urlRecords.length,
        completed: successful,
        failed,
      },
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
    })

    return {
      results,
      summary: {
        total: urlRecords.length,
        successful,
        failed,
        cached,
        totalTime,
      },
    }
  }
}
