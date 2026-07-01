'use client'

import { useReveal } from './use-reveal'

export function FinalCta() {
  const { ref, visible } = useReveal<HTMLDivElement>()

  const scrollToTool = () => {
    document.getElementById('tool')?.scrollIntoView({ behavior: 'smooth' })
  }

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
          Bring the document you actually work with. Ask the question that
          usually costs you twenty minutes of scrolling. Read the answer, then
          click the citation to see the exact page it came from.
        </p>

        <div className="mt-10 flex justify-center">
          <button
            onClick={scrollToTool}
            className="group relative inline-flex items-center gap-2 rounded-lg bg-accent px-7 py-3.5 text-sm font-semibold text-accent-foreground shadow-[0_8px_24px_-8px_rgba(122,46,72,0.6)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_10px_30px_-6px_rgba(122,46,72,0.7)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
