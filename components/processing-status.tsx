import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react"

// This would fetch real data from your API
async function getProcessingStatus() {
  // Placeholder data - replace with actual API call
  return {
    domain: "example.com",
    status: "completed" as const,
    progress: {
      total: 150,
      completed: 150,
      failed: 3,
    },
    startedAt: new Date(Date.now() - 300000).toISOString(),
    completedAt: new Date().toISOString(),
  }
}

export async function ProcessingStatus() {
  const status = await getProcessingStatus()

  if (!status) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground text-center">No active processing</p>
      </Card>
    )
  }

  const progressPercentage = (status.progress.completed / status.progress.total) * 100
  const isActive = ["parsing", "indexing", "scraping"].includes(status.status)

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-balance">{status.domain}</h3>
            <p className="text-sm text-muted-foreground capitalize">{status.status}</p>
          </div>

          <div className="flex items-center gap-2">
            {isActive && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
            {status.status === "completed" && <CheckCircle2 className="w-5 h-5 text-accent" />}
            {status.status === "error" && <XCircle className="w-5 h-5 text-destructive" />}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {status.progress.completed} / {status.progress.total}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{status.progress.total}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-accent">{status.progress.completed}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold text-destructive">{status.progress.failed}</p>
          </div>
        </div>

        {status.startedAt && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t border-border">
            <Clock className="w-4 h-4" />
            <span>Started {new Date(status.startedAt).toLocaleString()}</span>
          </div>
        )}
      </div>
    </Card>
  )
}
