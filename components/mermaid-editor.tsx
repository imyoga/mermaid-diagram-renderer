"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import mermaid from "mermaid"
import { Button } from "@/components/ui/button"
import { DiagramViewer } from "@/components/diagram-viewer"

const DEFAULT_CODE = `flowchart TD
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Ship it]
    B -- No --> D[Debug]
    D --> B
    C --> E[Celebrate]`

let mermaidInitialized = false

function ensureMermaidInitialized() {
  if (mermaidInitialized) return
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
  })
  mermaidInitialized = true
}

export function MermaidEditor() {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [svg, setSvg] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const renderIdRef = useRef(0)

  const render = useCallback(async (source: string) => {
    ensureMermaidInitialized()
    const trimmed = source.trim()
    if (!trimmed) {
      setSvg("")
      setError(null)
      return
    }
    const currentId = ++renderIdRef.current
    try {
      // Validate first so we can surface a clean error message.
      await mermaid.parse(trimmed)
      const { svg: rendered } = await mermaid.render(`mermaid-graph-${currentId}`, trimmed)
      // Ignore stale renders (fast typing).
      if (currentId !== renderIdRef.current) return
      setSvg(rendered)
      setError(null)
    } catch (err) {
      if (currentId !== renderIdRef.current) return
      setError(err instanceof Error ? err.message : "Failed to render diagram")
    }
  }, [])

  // Debounced re-render on code change.
  useEffect(() => {
    const timeout = setTimeout(() => {
      void render(code)
    }, 300)
    return () => clearTimeout(timeout)
  }, [code, render])

  return (
    <div className="flex h-dvh w-full flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <path d="M10 6.5h4a2 2 0 0 1 2 2V14" />
            </svg>
          </div>
          <h1 className="text-sm font-semibold tracking-tight">Mermaid Editor</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCode(DEFAULT_CODE)}
        >
          Reset
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Code section — 30% */}
        <section className="flex min-h-0 basis-[30%] flex-col border-b border-border md:border-b-0 md:border-r">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Code
            </span>
            {error ? (
              <span className="text-xs font-medium text-destructive">Invalid syntax</span>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">Live</span>
            )}
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            aria-label="Mermaid diagram source code"
            className="min-h-0 flex-1 resize-none bg-card p-4 font-mono text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Type your Mermaid diagram code here..."
          />
          {error && (
            <div
              role="alert"
              className="max-h-40 shrink-0 overflow-auto border-t border-border bg-destructive/10 p-3 font-mono text-xs leading-relaxed text-destructive"
            >
              {error}
            </div>
          )}
        </section>

        {/* View section — 70% */}
        <section className="flex min-h-0 basis-[70%] flex-col bg-muted/30">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Diagram
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Scroll to zoom · drag to pan · double-click to fit
            </span>
          </div>
          {svg ? (
            <DiagramViewer svg={svg} />
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
              {error ? "Fix the errors to see your diagram." : "Start typing to see your diagram."}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
