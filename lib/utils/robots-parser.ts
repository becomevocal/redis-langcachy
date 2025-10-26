/**
 * Parse robots.txt to find sitemap URLs
 */
export async function findSitemapInRobots(domain: string): Promise<string[]> {
  try {
    const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`
    const robotsUrl = `${new URL(baseUrl).origin}/robots.txt`

    const response = await fetch(robotsUrl)
    if (!response.ok) return []

    const robotsText = await response.text()
    const sitemapUrls: string[] = []

    // Parse robots.txt for Sitemap: directives
    const lines = robotsText.split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.toLowerCase().startsWith("sitemap:")) {
        const url = trimmed.substring(8).trim()
        if (url) sitemapUrls.push(url)
      }
    }

    return sitemapUrls
  } catch {
    return []
  }
}
