import { Card } from "@/components/ui/card"
import { Database, Zap, TrendingUp } from "lucide-react"

// This would fetch real data from your API
async function getCacheStats() {
  // Placeholder data - replace with actual API call
  return {
    totalUrls: 150,
    cachedPrompts: 145,
    cachedResponses: 142,
    cacheHitRate: 94.7,
  }
}

export async function CacheStats() {
  const stats = await getCacheStats()

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
