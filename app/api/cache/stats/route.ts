import { NextResponse } from "next/server"
import { RedisService } from "@/lib/services/redis-service"
import { LangCacheService } from "@/lib/services/langcache-service"

export async function POST(request: Request) {
  try {
    const { domain } = await request.json()

    if (!domain) {
      return NextResponse.json({ error: "Domain is required" }, { status: 400 })
    }

    const redisService = new RedisService()
    const langCacheService = new LangCacheService()

    // Get all URLs for domain
    const urlRecords = await redisService.getUrlsByDomain(domain, 1000)
    const urls = urlRecords.map((record) => record.url)

    // Get cache statistics
    const cacheStats = await langCacheService.getCacheStats(urls)

    return NextResponse.json({
      domain,
      totalUrls: cacheStats.total,
      cachedResponses: cacheStats.cached,
      uncached: cacheStats.uncached,
      cacheHitRate: cacheStats.total > 0 ? ((cacheStats.cached / cacheStats.total) * 100).toFixed(1) : 0,
    })
  } catch (error) {
    console.error("[v0] Cache stats error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
