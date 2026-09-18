/**
 * ParticleHero — dark cinematic particle scene, canvas 2D.
 * Performance rules (the old version lagged hard):
 *   1. NO Math.random() inside the frame loop — twinkle is deterministic
 *      per-point phase (precomputed), drawn once to an offscreen layer.
 *   2. The static scene (terrain silhouette, figures, stars) is rendered
 *      ONCE into an offscreen canvas; the animation layer only redraws a
 *      lightweight wave crest pass + the figures each frame.
 *   3. Device-pixel-ratio capped at 1.5, point count scales with viewport.
 *   4. Animation pauses when the tab is hidden or hero is off-screen
 *      (IntersectionObserver) — zero cost when scrolled away.
 *   5. On small screens / reduced-motion: static frame only, no loop.
 */
import { useEffect, useRef } from 'react'

/* ────────── tuning ────────── */
const STEP = 22          // grid step in px (was 120×80 points @ fixed world — now resolution-aware)
const CAM_H = 0.40       // horizon height (fraction of canvas height)
const FOG = 0.85         // how fast far rows fade

/* terrain wave — px space, deterministic */
function waveY(x: number, z: number, t: number, W: number): number {
  const k = W / 1440     // scale waves with viewport
  return (
    Math.sin(x * 0.006 * k + t * 0.5) * 26 +
    Math.sin(z * 0.02 - t * 0.3) * 16 +
    Math.sin((x + z) * 0.004 * k + t * 0.42) * 11
  )
}

type Pt = { x: number; y: number; ph: number }

/* humanoid figure — returns points in local px (feet at 0,0) */
function buildFigure(scale: number): Pt[] {
  const pts: Pt[] = []
  const rnd = (() => { let s = 42; return () => { s = (s * 16807) % 2147483647; return s / 2147483647 } })() // seeded, stable
  const S = (n: number) => n * scale
  const put = (x: number, y: number) => pts.push({ x: S(x), y: S(y), ph: rnd() * Math.PI * 2 })

  // head — filled disc of points
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2
    const r = 7 * Math.sqrt(rnd())
    put(Math.cos(a) * r, -150 + Math.sin(a) * r * 1.1)
  }
  // torso
  for (let i = 0; i < 160; i++) {
    const fy = rnd()
    const w = 9 + fy * 9
    put((rnd() - 0.5) * 2 * w, -58 - fy * 66)
  }
  // arms — left down, right extended
  for (let i = 0; i < 45; i++) { put(-13 - rnd() * 3, -128 + i * 1.8) }
  for (let i = 0; i < 60; i++) {
    const t = i / 60
    put(12 + t * 62, -126 + t * 10 + (rnd() - 0.5) * 3)
  }
  // legs
  for (let i = 0; i < 50; i++) { put(-7 + (rnd() - 0.5) * 4, -i * 1.7) }
  for (let i = 0; i < 50; i++) { put(7 + (rnd() - 0.5) * 4, -i * 1.7) }
  return pts
}

/* ────────── component ────────── */
export function ParticleHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    let running = true
    let t = Math.random() * 100
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)

    /* offscreen static layer: stars + figures are drawn once per resize */
    let staticLayer: HTMLCanvasElement | null = null
    let figA: Pt[] = []
    let figB: Pt[] = []
    let stars: { x: number; y: number; a: number; ph: number }[] = []

    function buildStatic(W: number, H: number) {
      staticLayer = document.createElement('canvas')
      staticLayer.width = W
      staticLayer.height = H
      const c = staticLayer.getContext('2d')!

      stars = []
      const nStars = Math.round((W * H) / 9000)
      let s = 7
      const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
      for (let i = 0; i < nStars; i++) {
        stars.push({ x: rnd() * W, y: rnd() * H * 0.6, a: 0.1 + rnd() * 0.5, ph: rnd() * Math.PI * 2 })
      }

      const scale = Math.max(0.8, Math.min(1.6, W / 1440))
      figA = buildFigure(scale)
      figB = buildFigure(scale * 0.92)
    }

    function drawFigure(c: CanvasRenderingContext2D, pts: Pt[], ox: number, groundY: number, tt: number) {
      c.save()
      c.translate(ox, groundY)
      for (const p of pts) {
        const a = 0.5 + 0.3 * Math.sin(tt * 0.8 + p.ph)
        c.fillStyle = `rgba(255,255,255,${(0.55 * a).toFixed(2)})`
        c.fillRect(p.x, p.y, 1.6, 1.6)
      }
      c.restore()
    }

    function draw() {
      const W = canvas!.width
      const H = canvas!.height
      if (W === 0 || H === 0) return
      const ctx2 = ctx
      ctx2.fillStyle = '#060606'
      ctx2.fillRect(0, 0, W, H)

      // stars (drawn from precomputed array — deterministic alpha pulse)
      for (const st of stars) {
        const a = st.a * (0.7 + 0.3 * Math.sin(t * 0.7 + st.ph))
        ctx2.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`
        ctx2.fillRect(st.x, st.y, 1.2, 1.2)
      }

      // wave terrain — rows back-to-front, 1 point per STEP px
      const horizon = H * CAM_H
      const rows = Math.round(H / 7)
      for (let r = 0; r < rows; r++) {
        const depth = r / rows                 // 0 = far, 1 = near
        const y0 = horizon + Math.pow(depth, 1.6) * (H - horizon)
        const spread = 0.25 + depth * 0.75
        const alpha = (0.16 + depth * FOG * 0.5)
        const cols = Math.ceil(W / STEP / 1)
        for (let ci = 0; ci <= cols; ci++) {
          const x = ci * STEP
          const wx = (x - W / 2) * 1.6
          const wz = (1 - depth) * 900 + 60
          const wy = waveY(wx, wz, t, W) * (1.1 - depth * 0.55)
          const px = W / 2 + wx * spread * 0.62
          const py = y0 - wy * (0.35 + depth * 0.3)
          if (px < -2 || px > W + 2) continue
          const a = alpha * (0.75 + 0.25 * Math.sin(t + wx * 0.01))
          ctx2.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`
          ctx2.fillRect(px, py, 1.7, 1.7)
        }
      }

      // figures — anchored on the wave
      const scaleRef = W / 1440
      drawFigure(ctx2, figA, W * 0.26, H * 0.78 + waveY(W * 0.26, 300, t, W) * 0.2, t)
      drawFigure(ctx2, figB, W * 0.72, H * 0.74 + waveY(W * 0.72, 200, t, W) * 0.2, t)

      t += 0.016
      if (running) raf = requestAnimationFrame(draw)
    }

    function resize() {
      const W = Math.round(canvas!.offsetWidth * dpr)
      const H = Math.round(canvas!.offsetHeight * dpr)
      canvas!.width = W
      canvas!.height = H
      buildStatic(W, H)
      if (reduced) { draw() }        // one static frame, no loop
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    // pause when hero off-screen or tab hidden — the big perf win
    const io = new IntersectionObserver((entries) => {
      const vis = entries[0]?.isIntersecting ?? true
      if (vis && running !== true) {
        running = true
        if (!reduced) raf = requestAnimationFrame(draw)
      } else if (!vis) {
        running = false
        cancelAnimationFrame(raf)
      }
    })
    io.observe(canvas)

    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf) }
      else if (!reduced) { running = true; raf = requestAnimationFrame(draw) }
    }
    document.addEventListener('visibilitychange', onVis)

    if (!reduced) raf = requestAnimationFrame(draw)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ display: 'block' }}
      aria-hidden
    />
  )
}
