"use client"

import { Card } from "@/components/ui/card"
import { Database, Zap, TrendingUp } from "lucide-react"
import { useEffect, useState } from "react"

interface CacheStatsData {
  totalUrls: number
  cachedPrompts: number
  cachedResponses: number
  cacheHitRate: number
}

export function CacheStats() {
  const [stats, setStats] = useState<CacheStatsData>({
    totalUrls: 0,
    cachedPrompts: 0,
    cachedResponses: 0,
    cacheHitRate: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/stats/overview")
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error("Failed to fetch cache stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 5000) // Refresh every 5 seconds

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-16 bg-muted rounded" />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total URLs</p>
            <p className="text-3xl font-bold mt-1">{stats.totalUrls}</p>
          </div>
          <Database className="w-8 h-8 text-primary" />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Cached Prompts</p>
            <p className="text-3xl font-bold mt-1">{stats.cachedPrompts}</p>
          </div>
          <Zap className="w-8 h-8 text-accent" />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Cached Responses</p>
            <p className="text-3xl font-bold mt-1">{stats.cachedResponses}</p>
          </div>
          <Zap className="w-8 h-8 text-accent" />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Cache Hit Rate</p>
            <p className="text-3xl font-bold mt-1">{stats.cacheHitRate}%</p>
          </div>
          <TrendingUp className="w-8 h-8 text-accent" />
        </div>
      </Card>
    </div>
  )
}
