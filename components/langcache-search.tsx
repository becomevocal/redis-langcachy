"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Loader2, Search } from "lucide-react"

interface SearchResult {
  id: string
  url: string
  pageName: string
  snippet: string
  similarity: number
  fetchedAt?: string
}

export function LangCacheSearch() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!query.trim()) {
      setError("Enter text to search cached content.")
      return
    }

    setIsSearching(true)
    setError(null)
    setHasSearched(true)

    try {
      const response = await fetch("/api/langcache/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Search failed")
      }

      setResults(Array.isArray(data.results) ? data.results : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error during search")
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <form onSubmit={handleSearch} className="flex flex-col gap-3 md:flex-row">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={'Search cached content (e.g. "pricing plans" or "semantic caching")'}
          disabled={isSearching}
        />
        <Button type="submit" disabled={isSearching}>
          {isSearching ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Searching…
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Search
            </>
          )}
        </Button>
      </form>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          {error}
        </div>
      )}

      {hasSearched && !isSearching && results.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">No cached entries matched that query.</p>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((result) => (
            <div key={result.id} className="p-4 border border-border rounded-lg bg-secondary/50 space-y-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-semibold text-balance">{result.pageName}</h4>
                    <Badge variant="outline" className="text-muted-foreground border-muted-foreground/20">
                      {(result.similarity * 100).toFixed(1)}% match
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground break-all">{result.url}</p>
                  {result.fetchedAt && (
                    <p className="text-xs text-muted-foreground">
                      Indexed {new Date(result.fetchedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                {result.url && (
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Open <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
