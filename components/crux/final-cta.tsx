'use client'

import { useReveal } from './use-reveal'

// Doesn't touch component state, so it lives outside the component — keeps
// the function identity stable across renders instead of rebuilding it every time.
function scrollToTool() {
  document.getElementById('tool')?.scrollIntoView({ behavior: 'smooth' })
}

export function FinalCta() {
  const { ref, visible } = useReveal<HTMLDivElement>()

  return (
    <section id="contact" className="px-6 py-28">
      <div
        ref={ref}
        className={`mx-auto max-w-2xl text-center reveal ${visible ? 'is-visible' : ''}`}
      >
        <h2 className="font-heading text-4xl font-extrabold leading-[1.1] tracking-tight text-balance md:text-5xl">
          Don&apos;t take our word for it.
        </h2>
        <p className="mt-5 text-lg font-medium leading-relaxed text-muted-foreground">
          Bring your hardest document. Ask your hardest question.
        </p>

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={scrollToTool}
            className="group relative inline-flex items-center gap-2 rounded-lg bg-accent px-7 py-3.5 text-sm font-semibold text-accent-foreground transition-all duration-200 hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Drop a document, ask a hard question
            <span className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </button>
        </div>

        <p className="mt-8 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          No account. Nothing stored. Your files leave when you do.
        </p>
      </div>
    </section>
  )
}
