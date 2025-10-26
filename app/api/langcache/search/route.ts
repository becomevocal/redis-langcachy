import { NextResponse } from "next/server"
import { LangCacheService } from "@/lib/services/langcache-service"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const query = typeof body?.query === "string" ? body.query.trim() : ""

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    const langCacheService = new LangCacheService()
    const results = await langCacheService.searchIndexedContent(query)

    return NextResponse.json({ results })
  } catch (error) {
    console.error("[v0] LangCache search endpoint error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
