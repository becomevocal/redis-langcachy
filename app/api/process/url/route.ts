import { NextResponse } from "next/server"
import { AIProcessor } from "@/lib/services/ai-processor"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { url, model, temperature } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Initialize AI processor
    const aiProcessor = new AIProcessor()

    // Process single URL with AI
    const result = await aiProcessor.processUrl(url, {
      model: model || "openai/gpt-4o-mini",
      temperature: temperature || 0.7,
      maxTokens: 2000,
    })

    return NextResponse.json({
      success: result.success,
      url: result.url,
      response: result.response,
      fromCache: result.fromCache,
      processingTime: result.processingTime,
      error: result.error,
    })
  } catch (error) {
    console.error("[v0] URL processing error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
