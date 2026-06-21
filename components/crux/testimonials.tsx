'use client'

import { useReveal } from './use-reveal'

const ITEMS = [
  {
    quote:
      'We reviewed a 300-page contract in 20 minutes. Previously that took our team two days.',
    author: 'Legal Operations, Commercial Law Firm',
  },
  {
    quote:
      'The source citation on every answer is what convinced our compliance team to adopt it.',
    author: 'Operations Manager, Insurance Firm',
  },
  {
    quote:
      'I uploaded our entire HR handbook. New hires now answer their own questions in seconds.',
    author: 'HR Director, Tech Company',
  },
]

export function Testimonials() {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <section className="px-6 py-24">
      <div ref={ref} className={`mx-auto max-w-5xl reveal ${visible ? 'is-visible' : ''}`}>
        <p className="text-center font-mono text-xs tracking-[0.25em] text-muted-foreground">
          TRUSTED BY TEAMS WHO CAN&apos;T AFFORD WRONG ANSWERS
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {ITEMS.map((t) => (
            <figure
              key={t.author}
              className="flex flex-col rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:border-accent/50 hover:shadow-[0_8px_40px_-12px_var(--accent)]"
            >
              <div className="flex gap-0.5 text-accent" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="m12 2 2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" />
                  </svg>
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-4 text-xs text-muted-foreground">
                — {t.author}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
