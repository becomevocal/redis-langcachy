import { NextResponse } from "next/server"
import { UrlIndexer } from "@/lib/services/url-indexer"
import { PageScraper } from "@/lib/services/page-scraper"
import { RedisService } from "@/lib/services/redis-service"

export async function POST(request: Request) {
  try {
    console.log("[v0] Starting sitemap processing...")

    const { sitemapUrl } = await request.json()

    if (!sitemapUrl) {
      return NextResponse.json({ error: "Sitemap URL is required" }, { status: 400 })
    }

    console.log("[v0] Processing sitemap URL:", sitemapUrl)

    let indexer: UrlIndexer
    let scraper: PageScraper
    let redisService: RedisService

    try {
      indexer = new UrlIndexer()
      scraper = new PageScraper()
      redisService = new RedisService()
      console.log("[v0] Services initialized successfully")
    } catch (error) {
      console.error("[v0] Service initialization failed:", error)
      return NextResponse.json(
        {
          error: "Failed to initialize services",
          message: error instanceof Error ? error.message : "Unknown error",
          details: "Check Redis connection configuration",
        },
        { status: 500 },
      )
    }

    // Step 1: Index sitemap URLs
    console.log("[v0] Starting sitemap indexing...")
    const indexResult = await indexer.indexSitemap(sitemapUrl, {
      maxUrls: 100,
      skipExisting: true,
      batchSize: 20,
    })

    if (!indexResult.success) {
      console.error("[v0] Indexing failed:", indexResult.errors)
      return NextResponse.json(
        {
          error: "Failed to index sitemap",
          details: indexResult.errors,
        },
        { status: 500 },
      )
    }

    console.log("[v0] Indexing completed:", indexResult)

    // Step 2: Get indexed URLs
    const urlRecords = await redisService.getUrlsByDomain(indexResult.domain, 100)
    console.log("[v0] Retrieved", urlRecords.length, "URLs from Redis")

    // Step 3: Scrape pages (first 10 for demo)
    const urlsToScrape = urlRecords.slice(0, 10).map((record) => record.url)
    console.log("[v0] Starting to scrape", urlsToScrape.length, "URLs")

    const scrapeResult = await scraper.scrapeMultiple(urlsToScrape, {
      timeout: 10000,
      retries: 2,
      delayBetweenRequests: 1000,
      cleanHtml: true,
      includeMetadata: true,
    })

    console.log("[v0] Scraping completed:", scrapeResult.summary)

    return NextResponse.json({
      success: true,
      indexing: {
        domain: indexResult.domain,
        totalUrls: indexResult.totalUrls,
        indexedUrls: indexResult.indexedUrls,
        skippedUrls: indexResult.skippedUrls,
      },
      scraping: {
        attempted: urlsToScrape.length,
        successful: scrapeResult.summary.success,
        failed: scrapeResult.summary.failed,
      },
    })
  } catch (error) {
    console.error("[v0] Sitemap processing error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
        stack: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.stack : undefined) : undefined,
      },
      { status: 500 },
    )
  }
}
