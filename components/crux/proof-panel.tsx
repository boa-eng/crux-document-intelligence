'use client'

import { useReveal } from './use-reveal'

// Doesn't touch component state, so it lives outside the component — keeps
// the function identity stable across renders instead of rebuilding it every time.
function scrollToTool() {
  document.getElementById('tool')?.scrollIntoView({ behavior: 'smooth' })
}

/**
 * "Proof, not promises" — a static, hand-authored example of Crux answering
 * with a citation, sitting between the process steps and the testimonials.
 * The right-hand panel is a one-off ink-dark spotlight (not a dark-mode
 * toggle — the rest of the site stays light) so the example answer reads
 * like a screenshot lifted out of the product. No API calls: every line of
 * the exchange below is fixed copy, not a live chat.
 */
export function ProofPanel() {
  // reused from the stats/testimonials reveal pattern: fires once, the
  // first time this section scrolls into view — that's also what triggers
  // the citation chip's ink-stamp animation below
  const { ref, visible } = useReveal<HTMLDivElement>(0.35)

  return (
    <section className="section-seam px-6 py-24">
      <div
        ref={ref}
        className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-border bg-card"
      >
        <div className="grid md:grid-cols-2">
          {/* LEFT — paper column */}
          <div className="flex flex-col justify-center gap-6 p-8 md:p-12">
            <span className="w-fit rounded-full border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Proof, not promises
            </span>

            <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-balance md:text-4xl">
              {/* two-tone treatment: text unchanged, just split at the
                  natural phrase break — opening muted, payoff bright */}
              <span className="text-muted-foreground">Every answer </span>
              <span className="text-foreground">shows its source.</span>
            </h2>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-border px-3 py-1 font-mono text-xs text-muted-foreground">
                Geotechnical report · 40 pages
              </span>
              <span className="rounded-full border border-border px-3 py-1 font-mono text-xs text-muted-foreground">
                Scanned tables · OCR
              </span>
            </div>

            <button
              type="button"
              onClick={scrollToTool}
              className="w-fit text-sm font-semibold text-accent transition-colors hover:text-accent-glow"
            >
              See it answer →
            </button>
          </div>

          {/* RIGHT — spotlight panel: a static screenshot-like exchange, not a
              live chat. It used to be the page's one dark moment against paper;
              now the whole page is ink, so it lifts a step LIGHTER and warmer
              than the card around it to keep reading as a spotlight */}
          <div
            className="flex flex-col justify-center gap-5 p-8 md:p-12"
            style={{ backgroundColor: '#26201A' }}
          >
            <p className="text-sm text-[#A8A29E]">
              What was the water table depth at borehole BH-06?
            </p>
            <p className="text-base leading-relaxed text-[#F5F3EE]">
              {/* value emphasized in a burgundy tone lifted for the dark
                  background — derived from the same --accent token, just
                  mixed lighter so it stays readable on ink */}
              <span style={{ color: 'color-mix(in srgb, var(--accent) 55%, white)' }} className="font-semibold">
                9.00 m below Natural Ground Level
              </span>
              , recorded during drilling per the site investigation log.
            </p>
            <span
              className={`w-fit rounded-full border border-[#4A423A] px-3 py-1 font-mono text-xs text-[#A8A29E] ${
                visible ? 'citation-stamp' : 'opacity-0'
              }`}
            >
              Geotechnical Soil Investigation report.pdf · Page 37
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
