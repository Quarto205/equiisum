"use client"

import { useEffect, useRef } from "react"

// Each icon is an animated pixel grid rendered at 60fps with RAF
// Colors are neon lime/green with white highlights matching the dark cyberpunk aesthetic

type IconType = "platform" | "agents" | "workflow" | "integrations" | "pricing"

interface PixelIconProps {
  type: IconType
  size?: number  // rendered px size (default 40)
}

// ── Platform icon: rotating node graph / core matrix ─────────────────────────
function drawPlatform(ctx: CanvasRenderingContext2D, W: number, t: number) {
  const cx = W / 2, cy = W / 2
  const r  = W * 0.36
  const ps = W / 12  // pixel size

  // Central node — pulsing neon green
  const pulse = 0.6 + 0.4 * Math.sin(t * 0.003)
  ctx.fillStyle = `rgba(74, 222, 128, ${pulse})`
  const cs = ps * 1.5
  ctx.fillRect(cx - cs / 2, cy - cs / 2, cs, cs)

  // 6 orbiting nodes
  const nodeCount = 6
  for (let i = 0; i < nodeCount; i++) {
    const angle = (i / nodeCount) * Math.PI * 2 + t * 0.0015
    const nx = cx + Math.cos(angle) * r
    const ny = cy + Math.sin(angle) * r
    const opacity = 0.4 + 0.6 * ((Math.sin(angle * 2 + t * 0.002) + 1) / 2)
    ctx.fillStyle = `rgba(74, 222, 128, ${opacity})`
    ctx.fillRect(Math.round(nx / ps) * ps - ps / 2, Math.round(ny / ps) * ps - ps / 2, ps, ps)

    // Connector line (pixelated)
    const steps = 5
    for (let s = 1; s < steps; s++) {
      const lx = cx + (nx - cx) * (s / steps)
      const ly = cy + (ny - cy) * (s / steps)
      const lo = (0.15 + 0.25 * (s / steps)) * pulse
      ctx.fillStyle = `rgba(34, 197, 94, ${lo})`
      ctx.fillRect(Math.round(lx / ps) * ps, Math.round(ly / ps) * ps, ps * 0.75, ps * 0.75)
    }
  }
}

// ── Agents icon: humanoid pixel figure running ───────────────────────────────
const AGENT_FRAMES: number[][][] = [
  // Frame 0 — stand
  [
    [0,0,1,1,1,1,0,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,0,0,1,1,0],
    [0,1,1,0,0,1,1,0],
    [0,0,1,0,0,1,0,0],
    [0,0,1,0,0,1,0,0],
  ],
  // Frame 1 — step left
  [
    [0,0,1,1,1,1,0,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
    [0,0,1,1,1,0,0,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,0,0,0,0,0],
    [0,0,0,0,0,1,1,0],
  ],
  // Frame 2 — stand
  [
    [0,0,1,1,1,1,0,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,0,0,1,1,0],
    [0,1,1,0,0,1,1,0],
    [0,0,1,0,0,1,0,0],
    [0,0,1,0,0,1,0,0],
  ],
  // Frame 3 — step right
  [
    [0,0,1,1,1,1,0,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
    [0,0,0,1,1,1,0,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,0,0,0,0,0],
    [0,0,0,0,0,1,1,0],
  ],
]

function drawAgents(ctx: CanvasRenderingContext2D, W: number, t: number) {
  const fps       = 6
  const frameIdx  = Math.floor(t / (1000 / fps)) % AGENT_FRAMES.length
  const frame     = AGENT_FRAMES[frameIdx]
  const rows      = frame.length
  const cols      = frame[0].length
  const ps        = Math.floor(W / cols)
  const offX      = Math.floor((W - cols * ps) / 2)
  const offY      = Math.floor((W - rows * ps) / 2)
  const bobY      = Math.sin(t * 0.012) * ps * 0.4

  frame.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!cell) return
      const opacity = 0.6 + 0.4 * Math.sin(t * 0.001 + r * 0.3)
      ctx.fillStyle = `rgba(74, 222, 128, ${opacity})`
      ctx.fillRect(offX + c * ps, offY + r * ps + bobY, ps - 1, ps - 1)
    })
  })
}

// ── Workflow icon: hourglass shape — cycles with neon sand ───────────────────
function drawWorkflow(ctx: CanvasRenderingContext2D, W: number, t: number) {
  const ps   = Math.floor(W / 12)
  const cx   = W / 2
  const cy   = W / 2

  const shape = [
    [1,1,1,1,1,1,1],
    [0,1,1,1,1,1,0],
    [0,0,1,1,1,0,0],
    [0,0,0,1,0,0,0],
    [0,0,1,1,1,0,0],
    [0,1,1,1,1,1,0],
    [1,1,1,1,1,1,1],
  ]

  const rows = shape.length
  const cols = shape[0].length
  const offX = cx - (cols * ps) / 2
  const offY = cy - (rows * ps) / 2

  const period = 2400
  const fill   = (t % period) / period

  shape.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!cell) return
      const isTopHalf = r < rows / 2
      const isMid     = r === Math.floor(rows / 2)
      let sandAlpha: number

      if (isTopHalf) {
        const rowFill = 1 - Math.min(1, fill * rows * 1.4 - r)
        sandAlpha = Math.max(0, rowFill)
      } else if (isMid) {
        sandAlpha = 0.6 + 0.4 * Math.sin(t * 0.008)
      } else {
        const rowFromCenter = r - Math.floor(rows / 2)
        const rowFill = Math.min(1, fill * rows * 1.4 - rowFromCenter)
        sandAlpha = Math.max(0, rowFill)
      }

      const baseAlpha = 0.2
      const alpha = Math.max(baseAlpha, sandAlpha * 0.95)
      ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`
      ctx.fillRect(offX + c * ps, offY + r * ps, ps - 1, ps - 1)
    })
  })
}

// ── Integrations icon: pixel grid of tiles that light up in sequence ──────────
function drawIntegrations(ctx: CanvasRenderingContext2D, W: number, t: number) {
  const cols = 5, rows = 4
  const ps   = Math.floor(W / (cols + 1))
  const gap  = 2
  const offX = Math.floor((W - cols * (ps + gap)) / 2)
  const offY = Math.floor((W - rows * (ps + gap)) / 2)
  const total = cols * rows
  const wave = (t * 0.0008)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx   = r * cols + c
      const phase = idx / total * Math.PI * 2
      const alpha = 0.15 + 0.8 * ((Math.sin(wave + phase) + 1) / 2)
      const x     = offX + c * (ps + gap)
      const y     = offY + r * (ps + gap)
      ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`
      ctx.fillRect(x, y, ps, ps)
    }
  }
}

// ── Pricing icon: stacked bar chart growing with neon accents ─────────────────
function drawPricing(ctx: CanvasRenderingContext2D, W: number, t: number) {
  const ps    = Math.floor(W / 12)
  const bars  = 3
  const bw    = ps * 2
  const gap   = ps
  const total = bars * bw + (bars - 1) * gap
  const offX  = Math.floor((W - total) / 2)
  const maxH  = W * 0.7

  const heights = [0.45, 0.75, 0.55]
  const wave = Math.sin(t * 0.0015) * 0.12

  heights.forEach((h, i) => {
    const animated = Math.max(0.1, h + wave * (i % 2 === 0 ? 1 : -1))
    const bh = animated * maxH
    const x  = offX + i * (bw + gap)
    const y  = W - bh - ps

    const rowCount = Math.floor(bh / ps)
    for (let row = 0; row < rowCount; row++) {
      const progress = 1 - row / rowCount
      const alpha    = 0.25 + progress * 0.75
      ctx.fillStyle  = `rgba(74, 222, 128, ${alpha})`
      ctx.fillRect(x, y + row * ps, bw, ps - 1)
    }
  })
}

// ── Canvas wrapper ────────────────────────────────────────────────────────────
export function PixelIcon({ type, size = 40 }: PixelIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1
      canvas.width  = size * dpr
      canvas.height = size * dpr
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, size, size)

      ctx.imageSmoothingEnabled = false

      switch (type) {
        case "platform":      drawPlatform(ctx, size, t);      break
        case "agents":        drawAgents(ctx, size, t);        break
        case "workflow":      drawWorkflow(ctx, size, t);      break
        case "integrations":  drawIntegrations(ctx, size, t);  break
        case "pricing":       drawPricing(ctx, size, t);       break
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [type, size])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
        display: "block",
        flexShrink: 0,
      }}
    />
  )
}
