import { createClient, type RedisClientType } from "redis"

// Singleton Redis client
let redis: RedisClientType | null = null

export async function getRedisClient(): Promise<RedisClientType> {
  if (!redis) {
    console.log("[v0] Initializing Redis client...")

    const redisUrl = process.env.REDIS_URL
    const redisHost = process.env.REDIS_HOST
    const redisPort = process.env.REDIS_PORT
    const redisUsername = process.env.REDIS_USERNAME
    const redisPassword = process.env.REDIS_PASSWORD

    if (!redisHost && !redisUrl) {
      throw new Error("Redis configuration missing: Please provide either REDIS_HOST or REDIS_URL")
    }

    // Use explicit configuration if host is provided, otherwise use URL
    if (redisHost) {
      console.log("[v0] Using explicit Redis configuration with host:", redisHost)

      if (!redisPassword) {
        throw new Error("REDIS_PASSWORD is required when using REDIS_HOST")
      }

      redis = createClient({
        username: redisUsername || "default",
        password: redisPassword,
        socket: {
          host: redisHost,
          port: redisPort ? Number.parseInt(redisPort) : 6379,
          reconnectStrategy: (retries) => {
            console.log(`[v0] Redis reconnection attempt ${retries}`)
            if (retries > 10) {
              return new Error("Max reconnection attempts reached")
            }
            return Math.min(retries * 100, 3000)
          },
        },
      })
    } else {
      console.log("[v0] Using URL-based Redis configuration")
      redis = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            console.log(`[v0] Redis reconnection attempt ${retries}`)
            if (retries > 10) {
              return new Error("Max reconnection attempts reached")
            }
            return Math.min(retries * 100, 3000)
          },
        },
      })
    }

    redis.on("error", (err) => console.error("[v0] Redis Client Error:", err))
    redis.on("connect", () => console.log("[v0] Redis Client Connected"))
    redis.on("reconnecting", () => console.log("[v0] Redis Client Reconnecting"))
    redis.on("ready", () => console.log("[v0] Redis Client Ready"))

    try {
      await Promise.race([
        redis.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Redis connection timeout after 10s")), 10000)),
      ])
      console.log("[v0] Redis connection established successfully")
    } catch (error) {
      console.error("[v0] Failed to connect to Redis:", error)
      redis = null
      throw new Error(`Redis connection failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  return redis
}

// Helper to disconnect Redis (useful for cleanup)
export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
  }
}

// Redis key patterns for organized data storage
export const RedisKeys = {
  // Sitemap metadata: sitemap:{domain}
  sitemap: (domain: string) => `sitemap:${domain}`,

  // URL index: url:{urlHash}
  url: (urlHash: string) => `url:${urlHash}`,

  // URL list by domain: urls:{domain}
  urlList: (domain: string) => `urls:${domain}`,

  // Processing status: status:{domain}
  status: (domain: string) => `status:${domain}`,

  // Page content cache: content:{urlHash}
  content: (urlHash: string) => `content:${urlHash}`,

  // Prompt cache: prompt:{urlHash}
  promptCache: (urlHash: string) => `prompt:${urlHash}`,

  // Response cache: response:{urlHash}
  responseCache: (urlHash: string) => `response:${urlHash}`,
}

// Type definitions for Redis data structures
export interface SitemapMetadata {
  domain: string
  sitemapUrl: string
  totalUrls: number
  processedUrls: number
  lastProcessed: string
  status: "pending" | "processing" | "completed" | "failed"
}

export interface UrlRecord {
  url: string
  urlHash: string
  domain: string
  pageName: string
  priority?: number
  lastmod?: string
  changefreq?: string
  indexed: string
  processed: boolean
  error?: string
}

export interface PageContent {
  url: string
  pageName: string
  markdown: string
  fetchedAt: string
  contentLength: number
}

export interface ProcessingStatus {
  domain: string
  status: "idle" | "parsing" | "indexing" | "scraping" | "completed" | "error"
  currentUrl?: string
  progress: {
    total: number
    completed: number
    failed: number
  }
  startedAt?: string
  completedAt?: string
  error?: string
}
