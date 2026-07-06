"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

const MIN_SCALE = 0.1
const MAX_SCALE = 8
const ZOOM_STEP = 1.2

type Transform = {
  scale: number
  x: number
  y: number
}

const IDENTITY: Transform = { scale: 1, x: 0, y: 0 }

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

export function DiagramViewer({ svg }: { svg: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState<Transform>(IDENTITY)
  const [isPanning, setIsPanning] = useState(false)
  const panStateRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null)

  // Fit the diagram to the available viewport space.
  const fitToScreen = useCallback(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return
    const svgEl = content.querySelector("svg")
    if (!svgEl) return

    // Use the SVG's intrinsic size at scale 1.
    const prevTransform = content.style.transform
    content.style.transform = "none"
    const contentRect = svgEl.getBoundingClientRect()
    content.style.transform = prevTransform

    const containerRect = container.getBoundingClientRect()
    const padding = 48
    const availW = containerRect.width - padding
    const availH = containerRect.height - padding
    if (contentRect.width === 0 || contentRect.height === 0) return

    const scale = clampScale(Math.min(availW / contentRect.width, availH / contentRect.height, 1))
    // Center the content.
    const scaledW = contentRect.width * scale
    const scaledH = contentRect.height * scale
    const x = (containerRect.width - scaledW) / 2
    const y = (containerRect.height - scaledH) / 2
    setTransform({ scale, x, y })
  }, [])

  // Re-fit whenever the diagram content changes.
  useLayoutEffect(() => {
    if (!svg) return
    // Defer so the SVG is in the DOM and measurable.
    const raf = requestAnimationFrame(() => fitToScreen())
    return () => cancelAnimationFrame(raf)
  }, [svg, fitToScreen])

  const zoomAtPoint = useCallback((factor: number, clientX: number, clientY: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const px = clientX - rect.left
    const py = clientY - rect.top
    setTransform((prev) => {
      const nextScale = clampScale(prev.scale * factor)
      const ratio = nextScale / prev.scale
      // Keep the point under the cursor stationary.
      const x = px - (px - prev.x) * ratio
      const y = py - (py - prev.y) * ratio
      return { scale: nextScale, x, y }
    })
  }, [])

  // Mouse-wheel zoom (attached natively so we can preventDefault).
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      zoomAtPoint(factor, e.clientX, e.clientY)
    }
    container.addEventListener("wheel", onWheel, { passive: false })
    return () => container.removeEventListener("wheel", onWheel)
  }, [zoomAtPoint])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      const container = containerRef.current
      if (!container) return
      container.setPointerCapture(e.pointerId)
      panStateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: transform.x,
        originY: transform.y,
      }
      setIsPanning(true)
    },
    [transform.x, transform.y],
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const pan = panStateRef.current
    if (!pan || pan.pointerId !== e.pointerId) return
    const dx = e.clientX - pan.startX
    const dy = e.clientY - pan.startY
    setTransform((prev) => ({ ...prev, x: pan.originX + dx, y: pan.originY + dy }))
  }, [])

  const endPan = useCallback((e: React.PointerEvent) => {
    const pan = panStateRef.current
    if (!pan || pan.pointerId !== e.pointerId) return
    panStateRef.current = null
    setIsPanning(false)
    const container = containerRef.current
    if (container?.hasPointerCapture(e.pointerId)) {
      container.releasePointerCapture(e.pointerId)
    }
  }, [])

  const zoomButton = useCallback(
    (factor: number) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      zoomAtPoint(factor, rect.left + rect.width / 2, rect.top + rect.height / 2)
    },
    [zoomAtPoint],
  )

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/30">
      <div
        ref={containerRef}
        className="h-full w-full touch-none select-none"
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onDoubleClick={fitToScreen}
      >
        <div
          ref={contentRef}
          className="origin-top-left [&_svg]:h-auto [&_svg]:max-w-none"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            width: "max-content",
          }}
          // The SVG is produced by mermaid from user code with securityLevel "loose".
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      {/* Zoom / pan controls */}
      <div className="absolute bottom-4 right-4 flex flex-col items-stretch gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-md backdrop-blur">
        <IconButton label="Zoom in" onClick={() => zoomButton(ZOOM_STEP)}>
          <svg {...ICON_PROPS}>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
          </svg>
        </IconButton>
        <IconButton label="Zoom out" onClick={() => zoomButton(1 / ZOOM_STEP)}>
          <svg {...ICON_PROPS}>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3M8 11h6" />
          </svg>
        </IconButton>
        <IconButton label="Fit to screen" onClick={fitToScreen}>
          <svg {...ICON_PROPS}>
            <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </IconButton>
        <IconButton label="Reset zoom" onClick={() => setTransform(IDENTITY)}>
          <svg {...ICON_PROPS}>
            <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </IconButton>
        <div className="mt-0.5 border-t border-border pt-1 text-center text-[10px] font-medium tabular-nums text-muted-foreground">
          {Math.round(transform.scale * 100)}%
        </div>
      </div>
    </div>
  )
}

const ICON_PROPS = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-foreground hover:bg-muted"
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {children}
    </Button>
  )
}
