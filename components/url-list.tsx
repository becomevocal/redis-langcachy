import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, CheckCircle2, Clock } from "lucide-react"
import { RedisService } from "@/lib/services/redis-service"
import type { UrlRecord } from "@/lib/redis"

async function getUrls(limit = 20): Promise<UrlRecord[]> {
  const redisService = new RedisService()
  const domains = await redisService.getDomains()

  if (domains.length === 0) {
    return []
  }

  const domainRecords = await Promise.all(domains.map((domain) => redisService.getUrlsByDomain(domain, limit)))

  return domainRecords
    .flat()
    .sort((a, b) => {
      const aTime = a.indexed ? new Date(a.indexed).getTime() : 0
      const bTime = b.indexed ? new Date(b.indexed).getTime() : 0
      return bTime - aTime
    })
    .slice(0, limit)
}

export async function UrlList() {
  const urls = await getUrls()

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
