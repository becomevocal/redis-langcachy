import { NextResponse } from "next/server"
import { ProcessingPipeline } from "@/lib/services/pipeline"

export async function POST(request: Request) {
  try {
    const { sitemapUrl, maxUrls, scrapeDelay, aiDelay, aiModel, aiTemperature } = await request.json()

    if (!sitemapUrl) {
      return NextResponse.json({ error: "Sitemap URL is required" }, { status: 400 })
    }

    // Initialize and run pipeline
    const pipeline = new ProcessingPipeline()

    const result = await pipeline.run(sitemapUrl, {
      maxUrls: maxUrls || 50,
      scrapeDelay: scrapeDelay || 1000,
      aiDelay: aiDelay || 2000,
      aiModel: aiModel || "openai/gpt-4o-mini",
      aiTemperature: aiTemperature || 0.7,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Pipeline error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
