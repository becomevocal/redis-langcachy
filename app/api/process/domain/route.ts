import { NextResponse } from "next/server"
import { AIProcessor } from "@/lib/services/ai-processor"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { domain, model, temperature } = await request.json()

    if (!domain) {
      return NextResponse.json({ error: "Domain is required" }, { status: 400 })
    }

    // Initialize AI processor
    const aiProcessor = new AIProcessor()

    // Process all URLs for the domain with AI
    const result = await aiProcessor.processDomain(domain, {
      model: model || "openai/gpt-4o-mini",
      temperature: temperature || 0.7,
      maxTokens: 2000,
      delayBetweenRequests: 2000,
    })

    return NextResponse.json({
      success: true,
      domain,
      summary: result.summary,
      results: result.results.slice(0, 10), // Return first 10 for preview
    })
  } catch (error) {
    console.error("[v0] Domain processing error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
