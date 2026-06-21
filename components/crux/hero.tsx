'use client'

import { useEffect, useRef, useState } from 'react'

export function Hero() {
  const sceneRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  // Subtle mouse-tracking parallax on the 3D element (max ~8px)
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 16
      const y = (e.clientY / window.innerHeight - 0.5) * 16
      setOffset({ x, y })
    }
    window.addEventListener('mousemove', handle)
    return () => window.removeEventListener('mousemove', handle)
  }, [])

  const scrollToTool = () => {
    document.getElementById('tool')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section
      id="hero"
      className="relative flex min-h-[100svh] flex-col items-center justify-center px-6 py-24 text-center"
    >
      {/* 3D slot — sits BEHIND the text */}
      <div
        id="spline-3d"
        ref={sceneRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
          transition: 'transform 0.3s ease-out',
        }}
      >
        {/*
          Spline embed point — replace the fallback below with:
          <spline-viewer url="SPLINE_URL_HERE"></spline-viewer>
          Scene concept: translucent floating document sheets orbiting a
          glowing blue crystalline core, slow rotation, soft refraction.
        */}
        <div className="crux-crystal opacity-70">
          <div
            className="crux-sheet"
            style={{ transform: 'translateZ(70px) rotate(-8deg)' }}
          />
          <div
            className="crux-sheet"
            style={{ transform: 'translateZ(-70px) rotate(10deg)' }}
          />
          <div
            className="crux-sheet"
            style={{ transform: 'rotateY(90deg) translateZ(70px)' }}
          />
          <div className="crux-crystal__face" />
          <div
            className="crux-crystal__face"
            style={{ transform: 'rotateY(90deg)' }}
          />
          <div className="crux-crystal__core" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center">
        <p
          className="fade-up font-mono text-xs tracking-[0.3em] text-muted-foreground"
          style={{ animationDelay: '0ms' }}
        >
          THE ANSWER IS IN THERE.
        </p>

        <h1
          className="fade-up mt-6 font-heading text-[40px] font-extrabold leading-[1.05] tracking-tight text-balance md:text-6xl"
          style={{ animationDelay: '50ms' }}
        >
          Crux finds it
          <br />
          in seconds.
        </h1>

        <p
          className="fade-up mt-6 max-w-xl text-lg font-medium leading-relaxed text-muted-foreground md:text-xl"
          style={{ animationDelay: '100ms' }}
        >
          Ask your documents anything. Get the answer — with the exact source to
          verify it.
        </p>

        <div
          className="fade-up mt-10 flex flex-col items-center gap-4 sm:flex-row"
          style={{ animationDelay: '150ms' }}
        >
          <button
            onClick={scrollToTool}
            className="group relative inline-flex items-center gap-2 rounded-lg bg-accent px-7 py-3.5 text-sm font-semibold text-accent-foreground shadow-[0_0_30px_-4px_var(--accent)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_40px_0px_var(--accent)] active:scale-[0.98]"
          >
            Try it now — no signup
            <span className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </button>
          <button
            onClick={scrollToTool}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/40 px-7 py-3.5 text-sm font-semibold text-foreground transition-all duration-200 hover:border-accent/50 hover:bg-card"
          >
            See how it works ↓
          </button>
        </div>

        <p
          className="fade-up mt-8 font-mono text-xs leading-relaxed text-muted-foreground"
          style={{ animationDelay: '200ms' }}
        >
          No account. No storage. Documents deleted when you close this tab.
        </p>
      </div>

      {/* Scroll indicator */}
      <button
        onClick={scrollToTool}
        aria-label="Scroll to the tool"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <svg
          className="bounce-chevron h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </section>
  )
}
