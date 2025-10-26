import { Card } from "@/components/ui/card"
import { Database, Zap, TrendingUp } from "lucide-react"
import { RedisService } from "@/lib/services/redis-service"

async function getCacheStats() {
  const redisService = new RedisService()

  const domains = await redisService.getDomains()
  if (domains.length === 0) {
    return {
      totalUrls: 0,
      cachedPrompts: 0,
      cachedResponses: 0,
      cacheHitRate: 0,
    }
  }

  const totalUrls = await Promise.all(domains.map((domain) => redisService.getUrlCount(domain))).then((results) =>
    results.reduce((sum, count) => sum + count, 0),
  )

  const cachedPrompts = await redisService.countKeys("prompt:*")
  const cachedResponses = await redisService.countKeys("response:*")

  const cacheHitRate = totalUrls > 0 ? Number(((cachedResponses / totalUrls) * 100).toFixed(1)) : 0

  return {
    totalUrls,
    cachedPrompts,
    cachedResponses,
    cacheHitRate,
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
