'use client'

import { useState } from 'react'
import { useReveal } from './use-reveal'

type Demo = {
  industry: string
  tag: string
  doc: string
  q: string
  a: string
  source: string
}

const DEMOS: Demo[] = [
  {
    industry: 'Legal',
    tag: 'LEGAL',
    doc: 'Employment Contract',
    q: 'What is the notice period?',
    a: '90 days written notice per Section 8...',
    source: 'contract.pdf · Page 14',
  },
  {
    industry: 'Medical',
    tag: 'MEDICAL',
    doc: 'Clinical Guidelines',
    q: 'What is the dosage for paediatric patients?',
    a: '10mg/kg per Chapter 4, Table 2...',
    source: 'guidelines.pdf · Page 67',
  },
  {
    industry: 'Finance',
    tag: 'FINANCE',
    doc: 'Annual Report',
    q: 'What was Q3 revenue for the Lagos branch?',
    a: '\u20a671 million per Finance Sheet, Cell F23...',
    source: 'report.xlsx · Sheet Finance',
  },
]

const TABS = ['All', 'Legal', 'Medical', 'Finance', 'HR']

// Doesn't touch component state, so it lives outside the component — keeps
// the function identity stable across renders instead of rebuilding it every time.
// Besides scrolling to the tool, it broadcasts the card's own question via a
// plain browser event ("crux:prefill") — the tool listens for it and drops the
// text into the composer. A DOM event because Demos and Tool are sibling
// components with no shared parent state; this avoids a context refactor.
function loadDemo(q: string) {
  window.dispatchEvent(new CustomEvent('crux:prefill', { detail: q }))
  document.getElementById('tool')?.scrollIntoView({ behavior: 'smooth' })
}

export function Demos() {
  const [active, setActive] = useState('All')
  const { ref, visible } = useReveal<HTMLDivElement>()

  const filtered =
    active === 'All' ? DEMOS : DEMOS.filter((d) => d.industry === active)

  return (
    <section className="section-seam section-band px-6 py-24">
      <div ref={ref} className={`mx-auto max-w-5xl reveal ${visible ? 'is-visible' : ''}`}>
        <p className="text-center font-mono text-xs tracking-[0.25em] text-muted-foreground">
          SEE IT IN ACTION
        </p>

        {/* filter tabs */}
        {/* below sm: tighter padding + text-xs so all five tabs hold one row
            at 390px (no wrap, no scroll); desktop sizes unchanged */}
        <div className="mt-6 flex items-center justify-center gap-0.5 sm:gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActive(tab)}
              className={`relative px-2.5 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                active === tab
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
              {active === tab && (
                <span className="absolute inset-x-2 -bottom-px sm:inset-x-3 h-0.5 rounded-full bg-accent" />
              )}
            </button>
          ))}
        </div>

        {/* cards — items-stretch + h-full flex-col so all three cards match
            heights even when answer copy differs in length */}
        <div className="mt-10 grid items-stretch gap-5 md:grid-cols-3">
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground">
              More {active} demos coming soon.
            </p>
          )}
          {filtered.map((d) => (
            <div
              key={d.tag}
              // site-wide card hover ("switch on"): hairline 8% → 20% white +
              // top-light 6% → 12%, 150ms. No translate/scale/shadow-grow.
              className="fade-in group flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[border-color,box-shadow] duration-150 hover:border-white/20 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
            >
              {/* category tag: a hairline label, not another accent fill — burgundy
                  stays reserved for the primary CTA and active states */}
              <span className="self-start rounded-full border border-border px-3 py-1 font-mono text-[11px] tracking-wide text-muted-foreground">
                {d.tag}
              </span>
              <p className="mt-4 text-xs text-muted-foreground">
                Document: {d.doc}
              </p>
              <p className="mt-3 text-sm font-semibold text-foreground">
                Q: {d.q}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A: {d.a}
              </p>
              {/* mt-auto pins this whole footer block (source chip + link) to the
                  card bottom, so both rows sit on one consistent line across
                  cards no matter how long each answer runs; pt-4 keeps a fixed
                  minimum gap to the answer text on the tallest card */}
              <div className="mt-auto flex flex-col items-start pt-4">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-teal/40 bg-teal/10 px-3 py-1 font-mono text-[11px] text-teal">
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {d.source}
              </span>
              <button
                type="button"
                onClick={() => loadDemo(d.q)}
                className="mt-4 text-sm font-semibold text-accent transition-colors hover:text-accent-glow"
              >
                Try a demo like this →
              </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
