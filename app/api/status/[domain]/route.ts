import { NextResponse } from "next/server"
import { RedisService } from "@/lib/services/redis-service"

export async function GET(request: Request, { params }: { params: Promise<{ domain: string }> }) {
  try {
    const { domain } = await params

    if (!domain) {
      return NextResponse.json({ error: "Domain is required" }, { status: 400 })
    }

    const redisService = new RedisService()

    // Get processing status
    const status = await redisService.getProcessingStatus(domain)

    if (!status) {
      return NextResponse.json({ error: "No status found for domain" }, { status: 404 })
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error("[v0] Status fetch error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
