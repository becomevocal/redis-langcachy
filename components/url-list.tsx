"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, CheckCircle2, Clock } from "lucide-react"
import { useEffect, useState } from "react"

interface UrlRecord {
  url: string
  urlHash: string
  domain: string
  pageName: string
  priority?: number
  lastmod?: string
  changefreq?: string
  indexed: string
  processed: boolean
  error?: string
}

export function UrlList() {
  const [urls, setUrls] = useState<UrlRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUrls() {
      try {
        const response = await fetch("/api/urls/recent?limit=20")
        if (response.ok) {
          const data = await response.json()
          setUrls(data)
        }
      } catch (error) {
        console.error("Failed to fetch URLs:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUrls()
    const interval = setInterval(fetchUrls, 10000) // Refresh every 10 seconds

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Card className="p-6">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </Card>
    )
  }

  if (urls.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground text-center">No URLs indexed yet</p>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="space-y-3">
        {urls.map((url) => (
          <div
            key={url.url}
            className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-balance">{url.pageName || url.url}</h4>
                <Badge variant="outline" className="bg-background text-muted-foreground border-muted-foreground/20">
                  {url.domain}
                </Badge>
                {url.processed ? (
                  <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Processed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    <Clock className="w-3 h-3 mr-1" />
                    Pending
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">{url.url}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Indexed {url.indexed ? new Date(url.indexed).toLocaleString() : "unknown"}
              </p>
            </div>

            <a
              href={url.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-4 p-2 rounded-lg hover:bg-background transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </a>
          </div>
        ))}
      </div>
    </Card>
  )
}
