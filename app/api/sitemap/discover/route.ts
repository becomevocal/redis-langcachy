import { NextResponse } from "next/server"
import { UrlIndexer } from "@/lib/services/url-indexer"
import { PageScraper } from "@/lib/services/page-scraper"

export async function POST(request: Request) {
  try {
    const { domain } = await request.json()

    if (!domain) {
      return NextResponse.json({ error: "Domain is required" }, { status: 400 })
    }

    // Initialize services
    const indexer = new UrlIndexer()
    const scraper = new PageScraper()

    // Auto-discover and index sitemap
    const indexResult = await indexer.autoDiscoverAndIndex(domain, {
      maxUrls: 100,
      skipExisting: true,
      batchSize: 20,
    })

    if (!indexResult.success) {
      return NextResponse.json(
        {
          error: "Failed to discover or index sitemap",
          details: indexResult.errors,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      domain: indexResult.domain,
      totalUrls: indexResult.totalUrls,
      indexedUrls: indexResult.indexedUrls,
      skippedUrls: indexResult.skippedUrls,
    })
  } catch (error) {
    console.error("[v0] Sitemap discovery error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
