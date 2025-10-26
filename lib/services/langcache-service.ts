import { LangCache } from "@redis-ai/langcache"
import { RedisService } from "./redis-service"
import { extractDomain, hashUrl } from "@/lib/utils/hash"
import type { PageContent, ResponseCacheEntry } from "@/lib/redis"

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

export interface LangCacheSearchResult {
  id: string
  url: string
  pageName: string
  snippet: string
  similarity: number
  prompt: string
  fetchedAt?: string
}

interface LangCacheConfig {
  serverURL: string
  cacheId: string
  apiKey: string
}

export class LangCacheService {
  private langCache: LangCache | null = null
  private redisService: RedisService
  private config: LangCacheConfig | null = null
  private missingConfigLogged = false

  constructor() {
    this.redisService = new RedisService()
  }

  private loadConfig(): LangCacheConfig | null {
    if (this.config) return this.config

    const apiKey = process.env.LANGCACHE_API_KEY
    if (!apiKey) {
      return null
    }

    const serverURL = process.env.LANGCACHE_SERVER_URL || "https://gcp-us-east4.langcache.redis.io"
    const cacheId = process.env.LANGCACHE_CACHE_ID || "477bdd847aa841ffa2852797d215dfc4"

    this.config = {
      serverURL,
      cacheId,
      apiKey,
    }

    return this.config
  }

  private async getLangCacheClient(): Promise<LangCache> {
    if (!this.langCache) {
      const config = this.loadConfig()
      if (!config) {
        throw new Error(
          "LangCache configuration missing: please set LANGCACHE_API_KEY (and optionally LANGCACHE_SERVER_URL, LANGCACHE_CACHE_ID).",
        )
      }

      this.langCache = new LangCache({
        serverURL: config.serverURL,
        cacheId: config.cacheId,
        apiKey: config.apiKey,
      })
    }

    return this.langCache
  }

  private handleConfigError(error: unknown): boolean {
    if (
      error instanceof Error &&
      error.message.includes("LangCache configuration missing")
    ) {
      if (!this.missingConfigLogged) {
        console.warn(
          "[v0] LangCache configuration missing; skipping remote LangCache operations. Set LANGCACHE_API_KEY to enable semantic indexing and search.",
        )
        this.missingConfigLogged = true
      }
      return true
    }
    return false
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
    const urlHash = hashUrl(url)
    await this.redisService.storePromptCache(urlHash, prompt)
  }

  /**
   * Retrieve cached prompt
   */
  async getCachedPrompt(url: string): Promise<string | null> {
    const urlHash = hashUrl(url)
    const cached = await this.redisService.getPromptCache(urlHash)
    return cached?.prompt ?? null
  }

  /**
   * Cache an AI response using LangCache
   */
  async cacheResponse(url: string, prompt: string, response: string): Promise<void> {
    const urlHash = hashUrl(url)
    const entry: ResponseCacheEntry = {
      prompt,
      response,
      cachedAt: new Date().toISOString(),
    }
    await this.redisService.storeResponseCache(urlHash, entry)
  }

  /**
   * Retrieve cached response
   */
  async getCachedResponse(url: string): Promise<CachedResponse | null> {
    const urlHash = hashUrl(url)
    const cached = await this.redisService.getResponseCache(urlHash)
    if (!cached) return null

    return {
      prompt: cached.prompt,
      response: cached.response,
      cachedAt: cached.cachedAt,
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
    const urlHash = hashUrl(url)
    await this.redisService.deletePromptCache(urlHash)
    await this.redisService.deleteResponseCache(urlHash)
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
      const urlHash = hashUrl(url)
      const response = await this.redisService.getResponseCache(urlHash)
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

  /**
   * Index page content into LangCache for semantic search.
   */
  async indexPageContent(pageContent: PageContent): Promise<void> {
    try {
      const langCache = await this.getLangCacheClient()
      const urlHash = hashUrl(pageContent.url)
      const domain = extractDomain(pageContent.url)

      // Remove any existing entry for this URL before adding a new one
      await langCache
        .deleteQuery({
          attributes: {
            type: "page",
            urlHash,
          },
        })
        .catch(() => {
          // Ignore delete errors; entry might not exist yet
        })

      const normalizedMarkdown = pageContent.markdown.trim()
      if (!normalizedMarkdown) {
        return
      }

      const maxPromptLength = 1024
      const prompt =
        normalizedMarkdown.length > maxPromptLength
          ? `${normalizedMarkdown.slice(0, maxPromptLength - 1)}…`
          : normalizedMarkdown

      const responsePayload = {
        url: pageContent.url,
        pageName: pageContent.pageName,
        markdownSnippet:
          normalizedMarkdown.length > 2000 ? `${normalizedMarkdown.slice(0, 1997)}...` : normalizedMarkdown,
        fetchedAt: pageContent.fetchedAt,
        domain,
      }

      await langCache.set({
        prompt,
        response: JSON.stringify(responsePayload),
        attributes: {
          type: "page",
          url: pageContent.url,
          urlHash,
          pageName: pageContent.pageName,
          domain,
        },
      })
    } catch (error) {
      if (this.handleConfigError(error)) return
      console.error("[v0] LangCache indexing failed:", error)
    }
  }

  /**
   * Search indexed LangCache results.
   */
  async searchIndexedContent(query: string): Promise<LangCacheSearchResult[]> {
    try {
      const langCache = await this.getLangCacheClient()
      const response = await langCache.search({
        prompt: query,
        attributes: {
          type: "page",
        },
      })

      return response.data.map((entry) => {
        let parsed: {
          url?: string
          pageName?: string
          markdown?: string
          fetchedAt?: string
          domain?: string
        } | null = null

        try {
          parsed = JSON.parse(entry.response)
        } catch {
          parsed = null
        }

        const content = parsed?.markdownSnippet ?? parsed?.markdown ?? entry.response
        const snippet = content.length > 280 ? `${content.slice(0, 277)}...` : content

        return {
          id: entry.id,
          url: entry.attributes?.url || parsed?.url || "",
          pageName: entry.attributes?.pageName || parsed?.pageName || "Untitled",
          snippet,
          similarity: entry.similarity,
          prompt: entry.prompt,
          fetchedAt: parsed?.fetchedAt,
        }
      })
    } catch (error) {
      if (this.handleConfigError(error)) return []
      console.error("[v0] LangCache search failed:", error)
      return []
    }
  }
}
