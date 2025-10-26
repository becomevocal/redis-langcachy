import { LangCache } from "@redis-ai/langcache"
import { RedisService } from "./redis-service"
import { hashUrl } from "@/lib/utils/hash"
import type { PageContent } from "@/lib/redis"
import { getRedisClient } from "@/lib/redis"

export interface PromptData {
  pageName: string
  pageData: {
    url: string
    content: string
  }
}

export interface CachedResponse {
  prompt: string
  response: string
  cachedAt: string
  fromCache: boolean
}

export class LangCacheService {
  private langCache: LangCache | null = null
  private redisService: RedisService

  constructor() {
    this.redisService = new RedisService()
  }

  private async getLangCache(): Promise<LangCache> {
    if (!this.langCache) {
      // Get the Redis client instance
      const redisClient = await getRedisClient()

      // Initialize LangCache with the Redis client
      this.langCache = new LangCache({
        redis: redisClient,
        ttl: 60 * 60 * 24 * 7, // 7 days default TTL
      })
    }

    return this.langCache
  }

  /**
   * Generate a structured prompt from page content
   */
  generatePrompt(pageContent: PageContent): string {
    const promptData: PromptData = {
      pageName: pageContent.pageName,
      pageData: {
        url: pageContent.url,
        content: pageContent.markdown,
      },
    }

    // Create a structured prompt with clear formatting
    const prompt = `Page Analysis Request

Page Name: ${promptData.pageName}

Page Data:
${JSON.stringify(promptData.pageData, null, 2)}

Please analyze this page content and provide insights about:
1. Main topics and themes
2. Key information and takeaways
3. Content structure and organization
4. Potential use cases or applications`

    return prompt
  }

  /**
   * Cache a prompt using LangCache
   */
  async cachePrompt(url: string, prompt: string): Promise<void> {
    const langCache = await this.getLangCache()
    const urlHash = hashUrl(url)
    const cacheKey = `prompt:${urlHash}`

    await langCache.set(cacheKey, prompt)
  }

  /**
   * Retrieve cached prompt
   */
  async getCachedPrompt(url: string): Promise<string | null> {
    const langCache = await this.getLangCache()
    const urlHash = hashUrl(url)
    const cacheKey = `prompt:${urlHash}`

    const cached = await langCache.get(cacheKey)
    return cached || null
  }

  /**
   * Cache an AI response using LangCache
   */
  async cacheResponse(url: string, prompt: string, response: string): Promise<void> {
    const langCache = await this.getLangCache()
    const urlHash = hashUrl(url)

    // Use LangCache's semantic caching for the prompt-response pair
    await langCache.set(`response:${urlHash}`, {
      prompt,
      response,
      cachedAt: new Date().toISOString(),
    })
  }

  /**
   * Retrieve cached response
   */
  async getCachedResponse(url: string): Promise<CachedResponse | null> {
    const langCache = await this.getLangCache()
    const urlHash = hashUrl(url)
    const cacheKey = `response:${urlHash}`

    const cached = await langCache.get(cacheKey)
    if (!cached) return null

    return {
      ...(typeof cached === "string" ? JSON.parse(cached) : cached),
      fromCache: true,
    }
  }

  /**
   * Process a page: generate prompt, cache it, and prepare for AI response
   */
  async processPage(url: string): Promise<{
    success: boolean
    prompt?: string
    cached?: boolean
    error?: string
  }> {
    try {
      const urlHash = hashUrl(url)

      // Get page content from Redis
      const pageContent = await this.redisService.getPageContent(urlHash)
      if (!pageContent) {
        return {
          success: false,
          error: "Page content not found in cache",
        }
      }

      // Check if prompt is already cached
      const cachedPrompt = await this.getCachedPrompt(url)
      if (cachedPrompt) {
        return {
          success: true,
          prompt: cachedPrompt,
          cached: true,
        }
      }

      // Generate new prompt
      const prompt = this.generatePrompt(pageContent)

      // Cache the prompt
      await this.cachePrompt(url, prompt)

      return {
        success: true,
        prompt,
        cached: false,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Process page with AI and cache the response
   */
  async processWithAI(
    url: string,
    aiFunction: (prompt: string) => Promise<string>,
  ): Promise<{
    success: boolean
    response?: string
    fromCache?: boolean
    error?: string
  }> {
    try {
      // Check for cached response first
      const cachedResponse = await this.getCachedResponse(url)
      if (cachedResponse) {
        return {
          success: true,
          response: cachedResponse.response,
          fromCache: true,
        }
      }

      // Process page to get prompt
      const processResult = await this.processPage(url)
      if (!processResult.success || !processResult.prompt) {
        return {
          success: false,
          error: processResult.error || "Failed to generate prompt",
        }
      }

      // Call AI function with prompt
      const response = await aiFunction(processResult.prompt)

      // Cache the response
      await this.cacheResponse(url, processResult.prompt, response)

      return {
        success: true,
        response,
        fromCache: false,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Batch process multiple URLs
   */
  async batchProcess(
    urls: string[],
    aiFunction: (prompt: string) => Promise<string>,
    options: { delayBetweenRequests?: number } = {},
  ): Promise<
    Array<{
      url: string
      success: boolean
      response?: string
      fromCache?: boolean
      error?: string
    }>
  > {
    const { delayBetweenRequests = 1000 } = options
    const results = []

    for (const url of urls) {
      const result = await this.processWithAI(url, aiFunction)
      results.push({ url, ...result })

      // Rate limiting
      if (delayBetweenRequests > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenRequests))
      }
    }

    return results
  }

  /**
   * Clear cache for a specific URL
   */
  async clearCache(url: string): Promise<void> {
    const langCache = await this.getLangCache()
    const urlHash = hashUrl(url)
    await langCache.delete(`prompt:${urlHash}`)
    await langCache.delete(`response:${urlHash}`)
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(urls: string[]): Promise<{
    total: number
    cached: number
    uncached: number
  }> {
    let cached = 0
    let uncached = 0

    for (const url of urls) {
      const response = await this.getCachedResponse(url)
      if (response) {
        cached++
      } else {
        uncached++
      }
    }

    return {
      total: urls.length,
      cached,
      uncached,
    }
  }
}
