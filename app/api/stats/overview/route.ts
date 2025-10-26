import { NextResponse } from "next/server"
import { RedisService } from "@/lib/services/redis-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const redisService = new RedisService()

    const domains = await redisService.getDomains()
    if (domains.length === 0) {
      return NextResponse.json({
        totalUrls: 0,
        cachedPrompts: 0,
        cachedResponses: 0,
        cacheHitRate: 0,
      })
    }

    const totalUrls = await Promise.all(domains.map((domain) => redisService.getUrlCount(domain))).then((results) =>
      results.reduce((sum, count) => sum + count, 0),
    )

    const cachedPrompts = await redisService.countKeys("prompt:*")
    const cachedResponses = await redisService.countKeys("response:*")

    const cacheHitRate = totalUrls > 0 ? Number(((cachedResponses / totalUrls) * 100).toFixed(1)) : 0

    return NextResponse.json({
      totalUrls,
      cachedPrompts,
      cachedResponses,
      cacheHitRate,
    })
  } catch (error) {
    console.error("[v0] Stats overview error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
