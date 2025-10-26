import { NextResponse } from "next/server"
import { RedisService } from "@/lib/services/redis-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")

    const redisService = new RedisService()
    const domains = await redisService.getDomains()

    if (domains.length === 0) {
      return NextResponse.json([])
    }

    const domainRecords = await Promise.all(domains.map((domain) => redisService.getUrlsByDomain(domain, limit)))

    const urls = domainRecords
      .flat()
      .sort((a, b) => {
        const aTime = a.indexed ? new Date(a.indexed).getTime() : 0
        const bTime = b.indexed ? new Date(b.indexed).getTime() : 0
        return bTime - aTime
      })
      .slice(0, limit)

    return NextResponse.json(urls)
  } catch (error) {
    console.error("[v0] Recent URLs error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
