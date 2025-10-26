import {
  getRedisClient,
  RedisKeys,
  type UrlRecord,
  type SitemapMetadata,
  type PageContent,
  type ProcessingStatus,
  type PromptCacheEntry,
  type ResponseCacheEntry,
} from "@/lib/redis"
import type { RedisClientType } from "redis"

export class RedisService {
  private redis: RedisClientType | null = null

  private async getClient(): Promise<RedisClientType> {
    if (!this.redis) {
      this.redis = await getRedisClient()
    }
    return this.redis
  }

  /**
   * Helper to iterate keys matching a pattern and run a callback.
   */
  private async scanKeys(pattern: string, onKey?: (key: string) => void): Promise<void> {
    const client = await this.getClient()
    const iterator = client.scanIterator({
      MATCH: pattern,
    })

    for await (const key of iterator) {
      const keyString = typeof key === "string" ? key : key.toString()
      onKey?.(keyString)
    }
  }

  /**
   * Store sitemap metadata
   */
  async storeSitemapMetadata(metadata: SitemapMetadata): Promise<void> {
    const client = await this.getClient()
    const key = RedisKeys.sitemap(metadata.domain)
    await client.set(key, JSON.stringify(metadata))
  }

  /**
   * Get sitemap metadata
   */
  async getSitemapMetadata(domain: string): Promise<SitemapMetadata | null> {
    const client = await this.getClient()
    const key = RedisKeys.sitemap(domain)
    const data = await client.get(key)
    return data ? JSON.parse(data) : null
  }

  /**
   * Index a URL into Redis
   */
  async indexUrl(urlRecord: UrlRecord): Promise<void> {
    const client = await this.getClient()
    const urlKey = RedisKeys.url(urlRecord.urlHash)
    const listKey = RedisKeys.urlList(urlRecord.domain)

    // Store URL record
    await client.set(urlKey, JSON.stringify(urlRecord))

    // Add to domain's URL list (sorted set with timestamp)
    await client.zAdd(listKey, {
      score: Date.now(),
      value: urlRecord.urlHash,
    })
  }

  /**
   * Get URL record by hash
   */
  async getUrlRecord(urlHash: string): Promise<UrlRecord | null> {
    const client = await this.getClient()
    const key = RedisKeys.url(urlHash)
    const data = await client.get(key)
    return data ? JSON.parse(data) : null
  }

  /**
   * Get all URLs for a domain
   */
  async getUrlsByDomain(domain: string, limit = 100, offset = 0): Promise<UrlRecord[]> {
    const client = await this.getClient()
    const listKey = RedisKeys.urlList(domain)

    // Get URL hashes from sorted set
    const hashes = await client.zRange(listKey, offset, offset + limit - 1)

    if (!hashes || hashes.length === 0) return []

    // Fetch all URL records
    const records = await Promise.all(hashes.map((hash) => this.getUrlRecord(hash)))

    return records.filter((r): r is UrlRecord => r !== null)
  }

  /**
   * Store page content
   */
  async storePageContent(urlHash: string, content: PageContent): Promise<void> {
    const client = await this.getClient()
    const key = RedisKeys.content(urlHash)
    await client.set(key, JSON.stringify(content), {
      EX: 60 * 60 * 24 * 7, // 7 days TTL
    })
  }

  /**
   * Get page content
   */
  async getPageContent(urlHash: string): Promise<PageContent | null> {
    const client = await this.getClient()
    const key = RedisKeys.content(urlHash)
    const data = await client.get(key)
    return data ? JSON.parse(data) : null
  }

  /**
   * Update URL processing status
   */
  async markUrlProcessed(urlHash: string, success: boolean, error?: string): Promise<void> {
    const client = await this.getClient()
    const urlRecord = await this.getUrlRecord(urlHash)
    if (!urlRecord) return

    urlRecord.processed = success
    if (error) urlRecord.error = error

    await client.set(RedisKeys.url(urlHash), JSON.stringify(urlRecord))
  }

  /**
   * Store processing status
   */
  async updateProcessingStatus(status: ProcessingStatus): Promise<void> {
    const client = await this.getClient()
    const key = RedisKeys.status(status.domain)
    await client.set(key, JSON.stringify(status), {
      EX: 60 * 60 * 24, // 24 hours TTL
    })
  }

  /**
   * Get processing status
   */
  async getProcessingStatus(domain: string): Promise<ProcessingStatus | null> {
    const client = await this.getClient()
    const key = RedisKeys.status(domain)
    const data = await client.get(key)
    return data ? JSON.parse(data) : null
  }

  /**
   * Get total URL count for a domain
   */
  async getUrlCount(domain: string): Promise<number> {
    const client = await this.getClient()
    const listKey = RedisKeys.urlList(domain)
    return await client.zCard(listKey)
  }

  /**
   * Store a cached prompt entry
   */
  async storePromptCache(urlHash: string, prompt: string): Promise<void> {
    const client = await this.getClient()
    const entry: PromptCacheEntry = {
      prompt,
      cachedAt: new Date().toISOString(),
    }
    await client.set(RedisKeys.promptCache(urlHash), JSON.stringify(entry))
  }

  /**
   * Retrieve a cached prompt entry
   */
  async getPromptCache(urlHash: string): Promise<PromptCacheEntry | null> {
    const client = await this.getClient()
    const data = await client.get(RedisKeys.promptCache(urlHash))
    if (!data) return null

    try {
      return JSON.parse(data) as PromptCacheEntry
    } catch (error) {
      console.error("[v0] Failed to parse prompt cache:", error)
      return null
    }
  }

  /**
   * Store a cached response entry
   */
  async storeResponseCache(urlHash: string, response: ResponseCacheEntry): Promise<void> {
    const client = await this.getClient()
    await client.set(RedisKeys.responseCache(urlHash), JSON.stringify(response))
  }

  /**
   * Retrieve a cached response entry
   */
  async getResponseCache(urlHash: string): Promise<ResponseCacheEntry | null> {
    const client = await this.getClient()
    const data = await client.get(RedisKeys.responseCache(urlHash))
    if (!data) return null

    try {
      return JSON.parse(data) as ResponseCacheEntry
    } catch (error) {
      console.error("[v0] Failed to parse response cache:", error)
      return null
    }
  }

  /**
   * Delete cached prompt and response entries
   */
  async deletePromptCache(urlHash: string): Promise<void> {
    const client = await this.getClient()
    await client.del(RedisKeys.promptCache(urlHash))
  }

  async deleteResponseCache(urlHash: string): Promise<void> {
    const client = await this.getClient()
    await client.del(RedisKeys.responseCache(urlHash))
  }

  /**
   * Get all domains that have cached data.
   */
  async getDomains(): Promise<string[]> {
    const domains = new Set<string>()

    await this.scanKeys("urls:*", (key) => {
      const colonIndex = key.indexOf(":")
      const domain = colonIndex !== -1 ? key.substring(colonIndex + 1) : key
      if (domain) {
        domains.add(domain)
      }
    })

    // Fallback to sitemap metadata keys (covers domains before URLs are indexed)
    await this.scanKeys("sitemap:*", (key) => {
      const colonIndex = key.indexOf(":")
      const domain = colonIndex !== -1 ? key.substring(colonIndex + 1) : key
      if (domain) {
        domains.add(domain)
      }
    })

    return Array.from(domains).sort()
  }

  /**
   * Count keys matching a pattern (e.g. prompt caches, response caches).
   */
  async countKeys(pattern: string): Promise<number> {
    let count = 0
    await this.scanKeys(pattern, () => {
      count++
    })
    return count
  }

  /**
   * Delete all data for a domain
   */
  async deleteDomainData(domain: string): Promise<void> {
    const client = await this.getClient()
    // Get all URL hashes
    const listKey = RedisKeys.urlList(domain)
    const hashes = await client.zRange(listKey, 0, -1)

    // Delete all URL records and content
    const deletePromises = hashes.flatMap((hash) => [
      client.del(RedisKeys.url(hash)),
      client.del(RedisKeys.content(hash)),
      client.del(RedisKeys.promptCache(hash)),
      client.del(RedisKeys.responseCache(hash)),
    ])

    // Delete sitemap metadata, URL list, and status
    deletePromises.push(
      client.del(RedisKeys.sitemap(domain)),
      client.del(listKey),
      client.del(RedisKeys.status(domain)),
    )

    await Promise.all(deletePromises)
  }
}
