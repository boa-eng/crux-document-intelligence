'use client'

import { useReveal } from './use-reveal'

// Fee anatomy before any fee: the two offers differ on ONE axis — whether
// anything persists — so the cards teach that axis and stop. No prices, no
// feature grids. Opaque ink cards with hairline borders (glass stays on the
// tool's chrome, per DESIGN.md); Teams gets the accent rim + lift because
// it's the offer firms should self-select into.
const TIERS = [
  {
    name: 'Private',
    line: 'In-memory only. Nothing persists. For individuals and trials.',
    favored: false,
  },
  {
    name: 'Teams',
    line: 'Persistent workspace. Your documents stay indexed. For firms.',
    favored: true,
  },
]

export function PricingAnatomy() {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <section className="section-seam px-6 py-24">
      <div
        ref={ref}
        className={`mx-auto max-w-3xl text-center reveal ${visible ? 'is-visible' : ''}`}
      >
        <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-balance md:text-4xl">
          Two ways to run Crux.
        </h2>
        {/* items-stretch + h-full: both cards fill the grid row so they always
            match heights regardless of copy length. Inset top highlight = the
            page-wide lit-from-above edge (opaque card, no glow). */}
        <div className="mt-12 grid items-stretch gap-4 sm:grid-cols-2">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={
                tier.favored
                  ? // static lift stays (positioning); hover only "switches
                    // on": rim one step brighter + doubled top-light, 150ms
                    'flex h-full flex-col rounded-2xl border border-[color-mix(in_srgb,var(--accent-bright)_45%,transparent)] bg-card p-6 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_40px_-20px_rgba(0,0,0,0.8)] transition-[border-color,box-shadow] duration-150 hover:border-[color-mix(in_srgb,var(--accent-bright)_65%,transparent)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_16px_40px_-20px_rgba(0,0,0,0.8)] sm:-translate-y-1.5'
                  : // site-wide card hover: hairline 8% → 20% white, top-light
                    // 6% → 12%. No movement, no shadow growth.
                    'flex h-full flex-col rounded-2xl border border-border bg-card p-6 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[border-color,box-shadow] duration-150 hover:border-white/20 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
              }
            >
              <h3
                // text-lg + min-h row: one card-title voice shared with the
                // why-crux comparison grid (same hierarchy level, same size)
                className={`flex min-h-[1.75rem] items-baseline font-heading text-lg font-bold tracking-tight ${
                  tier.favored ? 'text-accent' : 'text-foreground'
                }`}
              >
                {tier.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {tier.line}
              </p>
            </div>
          ))}
        </div>
        {/* mt-10 (not mt-8): the favored card is lifted -1.5, so the extra
            breathing room keeps this line from crowding the card bottoms. */}
        <p className="mt-10 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Pricing on request.
        </p>
      </div>
    </section>
  )
}
