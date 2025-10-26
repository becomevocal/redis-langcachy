"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Loader2, Globe, Search } from "lucide-react"
import { useRouter } from "next/navigation"

export function SitemapForm() {
  const [sitemapUrl, setSitemapUrl] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsProcessing(true)

    try {
      const response = await fetch("/api/sitemap/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sitemapUrl }),
      })

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text()
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`)
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to process sitemap")
      }

      // Refresh the page to show updated data
      router.refresh()
      setSitemapUrl("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAutoDiscover = async () => {
    if (!sitemapUrl) return

    setError(null)
    setIsProcessing(true)

    try {
      const response = await fetch("/api/sitemap/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: sitemapUrl }),
      })

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text()
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`)
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to discover sitemap")
      }

      router.refresh()
      setSitemapUrl("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sitemap-url">Sitemap URL or Domain</Label>
          <div className="flex gap-2">
            <Input
              id="sitemap-url"
              type="text"
              placeholder="https://example.com/sitemap.xml or example.com"
              value={sitemapUrl}
              onChange={(e) => setSitemapUrl(e.target.value)}
              disabled={isProcessing}
              className="flex-1"
            />
            <Button type="submit" disabled={isProcessing || !sitemapUrl}>
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 mr-2" />
                  Process Sitemap
                </>
              )}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Enter a sitemap URL to parse and index, or use auto-discover to find it automatically
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </form>
    </Card>
  )
}
