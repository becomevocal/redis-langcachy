import { NextResponse } from "next/server"
import { UrlIndexer } from "@/lib/services/url-indexer"
import { PageScraper } from "@/lib/services/page-scraper"
import { RedisService } from "@/lib/services/redis-service"

export async function POST(request: Request) {
  console.log("[v0] ===== SITEMAP PROCESSING STARTED =====")

  try {
    let sitemapUrl: string
    try {
      const body = await request.json()
      sitemapUrl = body.sitemapUrl
      console.log("[v0] Request body parsed successfully:", { sitemapUrl })
    } catch (error) {
      console.error("[v0] Failed to parse request body:", error)
      return NextResponse.json(
        { error: "Invalid request body", details: "Expected JSON with sitemapUrl field" },
        { status: 400 },
      )
    }

    if (!sitemapUrl) {
      console.error("[v0] Missing sitemapUrl in request")
      return NextResponse.json({ error: "Sitemap URL is required" }, { status: 400 })
    }

    console.log("[v0] Processing sitemap URL:", sitemapUrl)

    let indexer: UrlIndexer
    let scraper: PageScraper
    let redisService: RedisService

    try {
      console.log("[v0] Initializing services...")
      indexer = new UrlIndexer()
      scraper = new PageScraper()
      redisService = new RedisService()
      console.log("[v0] Services instantiated successfully")

      console.log("[v0] Testing Redis connection...")
      await redisService.getUrlCount("test-connection")
      console.log("[v0] Redis connection verified successfully")
    } catch (error) {
      console.error("[v0] Service initialization failed:", error)
      console.error("[v0] Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      return NextResponse.json(
        {
          error: "Failed to initialize services",
          message: error instanceof Error ? error.message : "Unknown error",
          details:
            "Check Redis connection configuration. Ensure REDIS_HOST, REDIS_PORT, REDIS_USERNAME, and REDIS_PASSWORD are set correctly.",
        },
        { status: 500 },
      )
    }

    // Step 1: Index sitemap URLs
    console.log("[v0] Starting sitemap indexing...")
    let indexResult
    try {
      indexResult = await indexer.indexSitemap(sitemapUrl, {
        maxUrls: 100,
        skipExisting: true,
        batchSize: 20,
      })
      console.log("[v0] Indexing completed:", indexResult)
    } catch (error) {
      console.error("[v0] Indexing failed with exception:", error)
      return NextResponse.json(
        {
          error: "Failed to index sitemap",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      )
    }

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

    // Step 2: Get indexed URLs
    console.log("[v0] Retrieving indexed URLs from Redis...")
    let urlRecords
    try {
      urlRecords = await redisService.getUrlsByDomain(indexResult.domain, 100)
      console.log("[v0] Retrieved", urlRecords.length, "URLs from Redis")
    } catch (error) {
      console.error("[v0] Failed to retrieve URLs:", error)
      return NextResponse.json(
        {
          error: "Failed to retrieve indexed URLs",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      )
    }

    // Step 3: Scrape pages (first 10 for demo)
    const urlsToScrape = urlRecords.slice(0, 10).map((record) => record.url)
    console.log("[v0] Starting to scrape", urlsToScrape.length, "URLs:", urlsToScrape)

    let scrapeResult
    try {
      scrapeResult = await scraper.scrapeMultiple(urlsToScrape, {
        timeout: 10000,
        retries: 2,
        delayBetweenRequests: 1000,
        cleanHtml: true,
        includeMetadata: true,
      })
      console.log("[v0] Scraping completed:", scrapeResult.summary)
    } catch (error) {
      console.error("[v0] Scraping failed with exception:", error)
      return NextResponse.json(
        {
          error: "Failed to scrape pages",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      )
    }

    console.log("[v0] ===== SITEMAP PROCESSING COMPLETED SUCCESSFULLY =====")

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
    console.error("[v0] ===== SITEMAP PROCESSING FAILED =====")
    console.error("[v0] Unexpected error:", error)
    console.error("[v0] Error stack:", error instanceof Error ? error.stack : "No stack trace")

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
