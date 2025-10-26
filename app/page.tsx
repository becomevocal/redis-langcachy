import { Suspense } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { SitemapForm } from "@/components/sitemap-form"
import { ProcessingStatus } from "@/components/processing-status"
import { UrlList } from "@/components/url-list"
import { CacheStats } from "@/components/cache-stats"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-8">
          {/* Sitemap Input Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-balance">Process Sitemap</h2>
            <SitemapForm />
          </section>

          {/* Processing Status Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-balance">Processing Status</h2>
            <Suspense fallback={<Skeleton className="h-48 w-full" />}>
              <ProcessingStatus />
            </Suspense>
          </section>

          {/* Cache Statistics Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-balance">Cache Statistics</h2>
            <Suspense fallback={<Skeleton className="h-32 w-full" />}>
              <CacheStats />
            </Suspense>
          </section>

          {/* URL List Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-balance">Indexed URLs</h2>
            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
              <UrlList />
            </Suspense>
          </section>
        </div>
      </main>
    </div>
  )
}
