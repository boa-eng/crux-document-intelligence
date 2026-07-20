'use client'

import { useEffect, useState } from 'react'

// Doesn't touch component state, so it lives outside the component — keeps
// the function identity stable across renders instead of rebuilding it every time.
function scrollToTool() {
  document.getElementById('tool')?.scrollIntoView({ behavior: 'smooth' })
}

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
          type="button"
          onClick={scrollToTool}
          className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          Try Crux
        </button>
      </div>
    </div>
  )
}
