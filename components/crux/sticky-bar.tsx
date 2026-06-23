'use client'

import { useEffect, useState } from 'react'

/**
 * Scroll handoff: once the hero scrolls out of view, a slim glass bar slides
 * down with the Crux wordmark and a single CTA. The hero gives up the stage;
 * the tool takes it. Apple does this on its product pages.
 */
export function StickyBar() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const hero = document.getElementById('hero')
    if (!hero) return
    const observer = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-80px 0px 0px 0px' },
    )
    observer.observe(hero)
    return () => observer.disconnect()
  }, [])

  const toTool = () =>
    document.getElementById('tool')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div
      className={`glass fixed inset-x-0 top-0 z-50 border-b border-border transition-all duration-300 ${
        show
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none -translate-y-full opacity-0'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
          Crux
        </span>
        <button
          onClick={toTool}
          className="group inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:scale-[1.03]"
        >
          Try it now
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">
            →
          </span>
        </button>
      </div>
    </div>
  )
}
