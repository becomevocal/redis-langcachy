import { Database, Zap } from "lucide-react"

export function DashboardHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
              <Database className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-balance">Sitemap Processor</h1>
              <p className="text-sm text-muted-foreground">Parse, index, and cache website content with AI</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-accent">LangCache Enabled</span>
          </div>
        </div>
      </div>
    </header>
  )
}
