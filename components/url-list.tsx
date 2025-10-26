import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, CheckCircle2, Clock } from "lucide-react"

// This would fetch real data from your API
async function getUrls() {
  // Placeholder data - replace with actual API call
  return [
    {
      url: "https://example.com",
      pageName: "Home",
      processed: true,
      indexed: new Date().toISOString(),
    },
    {
      url: "https://example.com/about",
      pageName: "About",
      processed: true,
      indexed: new Date().toISOString(),
    },
    {
      url: "https://example.com/contact",
      pageName: "Contact",
      processed: false,
      indexed: new Date().toISOString(),
    },
  ]
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
                <h4 className="font-medium text-balance">{url.pageName}</h4>
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
