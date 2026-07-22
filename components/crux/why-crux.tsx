'use client'

import { useReveal } from './use-reveal'

// The pre-emptive category defense: name the two things a visitor will
// mentally compare Crux against, concede what each does, and let the third
// column win on the one axis that matters (cited answers). Opaque ink cards,
// NOT glass — glass is reserved for the tool's chrome layer (DESIGN.md).
const COLUMNS = [
  {
    name: 'Ctrl+F',
    line: 'Finds words. Misses meaning.',
    crux: false,
  },
  {
    name: 'Chatbots',
    line: 'Answers from anywhere. Confidently wrong.',
    crux: false,
  },
  {
    name: 'Crux',
    line: 'Answers from your documents. With the page it came from.',
    crux: true,
  },
]

export function WhyCrux() {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <section className="section-seam px-6 py-24">
      <div
        ref={ref}
        className={`mx-auto max-w-4xl text-center reveal ${visible ? 'is-visible' : ''}`}
      >
        <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-balance md:text-4xl">
          {/* two-tone treatment: text unchanged, just split at the sentence
              break — opening clause muted, closing payoff bright, so the eye
              lands on the part that sells */}
          <span className="text-muted-foreground">Your team already wrote the answer.</span>{' '}
          <span className="text-foreground">Crux remembers where.</span>
        </h2>
        {/* items-stretch + h-full flex-col: every card fills its grid row, so
            all three read as the same height. The heading sits in a fixed
            min-height row so the one-liners below start at the same y across
            cards even if a heading ever wraps. Inset top highlight = the
            page-wide "lit from above" edge (no glow, no blur — opaque card). */}
        <div className="mt-12 grid items-stretch gap-4 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <div
              key={col.name}
              className={
                col.crux
                  ? // the favored column: accent rim + a small STATIC lift so
                    // the eye lands here last and stays (positioning, not a
                    // hover effect). Hover "switches on": rim brightens one
                    // step, top-light doubles — no movement, 150ms.
                    'flex h-full flex-col rounded-2xl border border-[color-mix(in_srgb,var(--accent-bright)_45%,transparent)] bg-card p-6 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_40px_-20px_rgba(0,0,0,0.8)] transition-[border-color,box-shadow] duration-150 hover:border-[color-mix(in_srgb,var(--accent-bright)_65%,transparent)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_16px_40px_-20px_rgba(0,0,0,0.8)] sm:-translate-y-1.5'
                  : // plain card hover = the same "switch on": hairline 8% →
                    // 20% white, inset top-light 6% → 12%. No translate/scale.
                    'flex h-full flex-col rounded-2xl border border-border bg-card p-6 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[border-color,box-shadow] duration-150 hover:border-white/20 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
              }
            >
              <h3
                className={`flex min-h-[1.75rem] items-baseline font-heading text-lg font-bold tracking-tight ${
                  col.crux ? 'text-accent' : 'text-foreground'
                }`}
              >
                {col.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {col.line}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
