import { NextResponse } from "next/server"
import { RedisService } from "@/lib/services/redis-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ domain: string }> }) {
  try {
    const { domain } = await params
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    if (!domain) {
      return NextResponse.json({ error: "Domain is required" }, { status: 400 })
    }

    const redisService = new RedisService()

    // Get URLs for domain
    const urls = await redisService.getUrlsByDomain(domain, limit, offset)
    const totalCount = await redisService.getUrlCount(domain)

    return NextResponse.json({
      urls,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount,
      },
    })
  } catch (error) {
    console.error("[v0] URLs fetch error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
