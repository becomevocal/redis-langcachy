# Web Scraping Configuration

This application uses multiple scraping strategies to handle different types of websites and anti-bot protection.

## Scraping Methods

### 1. Jina AI Reader (Default - Recommended)
- **Best for:** Most websites, especially those with anti-bot protection
- **Pros:** Bypasses most anti-bot systems, no setup required, returns clean markdown
- **Cons:** Requires internet connection to Jina's API
- **Usage:** Enabled by default with `useJinaReader: true`

### 2. Headless Browser (Playwright)
- **Best for:** JavaScript-heavy sites, SPAs, sites requiring browser rendering
- **Pros:** Full browser environment, handles JavaScript, cookies, and complex interactions
- **Cons:** Slower, requires more resources, needs Playwright installation
- **Usage:** Enable with `useBrowser: true`
- **Installation:** `npm install playwright && npx playwright install chromium`

### 3. Basic Fetch (Fallback)
- **Best for:** Simple static HTML sites
- **Pros:** Fast, lightweight, no dependencies
- **Cons:** Easily blocked by anti-bot systems, no JavaScript support
- **Usage:** Automatic fallback if other methods fail

## Configuration

### API Routes

When calling the scraping API, you can configure the scraping method:

\`\`\`typescript
// Use Jina AI Reader (default)
POST /api/process/url
{
  "url": "https://example.com",
  "useJinaReader": true
}

// Use headless browser
POST /api/process/url
{
  "url": "https://example.com",
  "useBrowser": true,
  "useJinaReader": false
}

// Use basic fetch only
POST /api/process/url
{
  "url": "https://example.com",
  "useJinaReader": false,
  "useBrowser": false
}
\`\`\`

### Scraping Options

\`\`\`typescript
interface ScrapingOptions {
  timeout?: number              // Request timeout in ms (default: 10000)
  retries?: number              // Number of retry attempts (default: 3)
  delayBetweenRequests?: number // Delay between requests in ms (default: 1000)
  includeMetadata?: boolean     // Include page metadata (default: true)
  cleanHtml?: boolean           // Remove unwanted elements (default: true)
  useJinaReader?: boolean       // Use Jina AI Reader (default: true)
  useBrowser?: boolean          // Use headless browser (default: false)
}
\`\`\`

## Handling Different Site Types

### Static HTML Sites
- Use default settings (Jina or basic fetch)
- Fast and efficient

### JavaScript-Heavy Sites (React, Vue, Angular)
- Enable `useBrowser: true`
- Playwright will render JavaScript before scraping

### Sites with Anti-Bot Protection (Cloudflare, etc.)
- Use Jina AI Reader (default)
- Jina handles most anti-bot systems automatically

### Rate-Limited Sites
- Increase `delayBetweenRequests` (e.g., 5000ms)
- Reduce `retries` to avoid triggering blocks

## Troubleshooting

### "Failed to fetch" errors
- Site may be blocking requests
- Try enabling `useJinaReader: true` or `useBrowser: true`

### Timeout errors
- Increase `timeout` value
- Site may be slow or require browser rendering

### Empty content
- Site may be JavaScript-rendered
- Enable `useBrowser: true`

### 403/429 errors
- Site is blocking your requests
- Use Jina AI Reader or add delays between requests

## Best Practices

1. **Start with Jina AI Reader** - It handles most cases automatically
2. **Use browser scraping sparingly** - It's slower and more resource-intensive
3. **Respect robots.txt** - Check site's scraping policies
4. **Add delays** - Use `delayBetweenRequests` to avoid overwhelming servers
5. **Monitor errors** - Check logs for patterns in failed scrapes
6. **Cache aggressively** - Avoid re-scraping the same content

## Performance Tips

- Jina AI Reader: ~2-5 seconds per page
- Headless Browser: ~5-15 seconds per page
- Basic Fetch: ~1-3 seconds per page

For bulk scraping, use batch processing with appropriate delays to balance speed and reliability.
