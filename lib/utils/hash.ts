import crypto from "crypto"

/**
 * Generate a consistent hash for a URL to use as Redis key
 */
export function hashUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex").substring(0, 16)
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace("www.", "")
  } catch {
    return "unknown"
  }
}

/**
 * Generate a readable page name from URL
 */
export function generatePageName(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname

    // Handle root path
    if (pathname === "/" || pathname === "") {
      return "Home"
    }

    // Remove trailing slash and split
    const segments = pathname.replace(/\/$/, "").split("/")
    const lastSegment = segments[segments.length - 1]

    // Convert kebab-case or snake_case to Title Case
    return lastSegment
      .replace(/[-_]/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  } catch {
    return "Unknown Page"
  }
}
