# Web Application Architecture - Sitemap Processor

A comprehensive web application that parses website sitemaps, indexes URLs into Redis, scrapes page content, converts to Markdown, and caches AI-generated prompts and responses using LangCache.

## Features

- **Sitemap Parsing**: Automatically discovers and parses XML sitemaps (including sitemap indexes)
- **Redis Integration**: Uses Redis Cloud with the standard node-redis client for efficient data storage
- **URL Indexing**: Stores and manages URLs with metadata in organized Redis data structures
- **Page Scraping**: Fetches page content with retry logic and rate limiting
- **Markdown Conversion**: Converts HTML content to clean Markdown format
- **AI Processing**: Generates structured prompts and caches responses using LangCache
- **Admin Dashboard**: Real-time monitoring of processing status, cache statistics, and URL management

## Prerequisites

- Node.js 18+ 
- Redis Cloud account or local Redis instance
- OpenAI API key (or other AI provider)

## Environment Variables

Create a `.env.local` file with the following variables:

### Option 1: Redis Cloud (Recommended)

\`\`\`env
# Redis Cloud Configuration
REDIS_HOST=redis-xxxxx.c280.us-central1-2.gce.redns.redis-cloud.com
REDIS_PORT=10759
REDIS_USERNAME=default
REDIS_PASSWORD=your-redis-password

# AI Configuration (for AI SDK)
OPENAI_API_KEY=your-openai-api-key
\`\`\`

### Option 2: Redis URL (Alternative)

\`\`\`env
# Redis URL Configuration
REDIS_URL=redis://default:your-password@your-redis-host:port

# AI Configuration (for AI SDK)
OPENAI_API_KEY=your-openai-api-key
\`\`\`

**Note**: The application will use explicit host/port configuration if `REDIS_HOST` is provided, otherwise it falls back to `REDIS_URL`.

## Installation

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to access the admin dashboard.

## Architecture Overview

### Data Flow

1. **Sitemap Discovery**: Enter a domain or sitemap URL
2. **URL Extraction**: Parse sitemap XML and extract all page URLs
3. **Redis Indexing**: Store URLs with metadata in Redis sorted sets
4. **Page Scraping**: Fetch HTML content for each URL
5. **Markdown Conversion**: Convert HTML to clean Markdown
6. **Prompt Generation**: Create structured prompts with page data
7. **AI Processing**: Generate responses and cache with LangCache
8. **Cache Management**: Retrieve cached responses for subsequent requests

### Redis Data Structure

\`\`\`
sitemap:{domain}          - Sitemap metadata
urls:{domain}             - Sorted set of URL hashes
url:{urlHash}             - Individual URL record
content:{urlHash}         - Page content (Markdown)
prompt:{urlHash}          - Cached prompt
response:{urlHash}        - Cached AI response
status:{domain}           - Processing status
\`\`\`

### Key Components

- **Redis Client** (`lib/redis.ts`): Singleton Redis connection with reconnection logic
- **Redis Service** (`lib/services/redis-service.ts`): Data access layer for all Redis operations
- **Sitemap Parser** (`lib/services/sitemap-parser.ts`): XML parsing and URL extraction
- **URL Indexer** (`lib/services/url-indexer.ts`): Batch URL indexing with progress tracking
- **Page Scraper** (`lib/services/page-scraper.ts`): HTML fetching and Markdown conversion
- **LangCache Service** (`lib/services/langcache-service.ts`): Prompt generation and caching
- **AI Processor** (`lib/services/ai-processor.ts`): AI response generation with cache integration
- **Processing Pipeline** (`lib/services/pipeline.ts`): Orchestrates the complete workflow

## API Routes

- `POST /api/sitemap/process` - Process a sitemap URL
- `POST /api/sitemap/discover` - Auto-discover sitemaps from domain
- `POST /api/process/domain` - Process all URLs for a domain
- `POST /api/process/url` - Process a single URL
- `GET /api/status/[domain]` - Get processing status
- `GET /api/urls/[domain]` - Get indexed URLs
- `GET /api/cache/stats` - Get cache statistics
- `POST /api/pipeline/run` - Run complete processing pipeline

## Usage

### Process a Sitemap

1. Navigate to the dashboard
2. Enter a sitemap URL or domain
3. Click "Process Sitemap"
4. Monitor progress in real-time
5. View indexed URLs and cache statistics

### Run Complete Pipeline

\`\`\`bash
curl -X POST http://localhost:3000/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com", "sitemapUrl": "https://example.com/sitemap.xml"}'
\`\`\`

## Performance Considerations

- **Batch Processing**: URLs are processed in configurable batches
- **Rate Limiting**: Configurable delays between requests
- **Retry Logic**: Exponential backoff for failed requests
- **Cache TTL**: 7-day default for content and responses
- **Connection Pooling**: Singleton Redis client with reconnection

## Security Best Practices

- Environment variables for sensitive credentials
- Input validation for URLs and domains
- Rate limiting to prevent abuse
- Error handling without exposing internals
- Robots.txt compliance checking

## License

MIT
