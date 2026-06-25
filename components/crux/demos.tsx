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

export function Demos() {
  const [active, setActive] = useState('All')
  const { ref, visible } = useReveal<HTMLDivElement>()

  const filtered =
    active === 'All' ? DEMOS : DEMOS.filter((d) => d.industry === active)

  const loadDemo = (industry: string) => {
    document.getElementById('tool')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="px-6 py-24">
      <div ref={ref} className={`mx-auto max-w-5xl reveal ${visible ? 'is-visible' : ''}`}>
        <p className="text-center font-mono text-xs tracking-[0.25em] text-muted-foreground">
          SEE IT IN ACTION
        </p>

        {/* filter tabs */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActive(tab)}
              className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                active === tab
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
              {active === tab && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />
              )}
            </button>
          ))}
        </div>

        {/* cards */}
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground">
              More {active} demos coming soon.
            </p>
          )}
          {filtered.map((d) => (
            <div
              key={d.tag}
              className="fade-in group flex flex-col rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:border-accent/50 hover:shadow-[0_8px_40px_-12px_var(--accent)]"
            >
              <span className="self-start rounded-full bg-accent/15 px-3 py-1 font-mono text-[11px] tracking-wide text-accent">
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
              <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-teal/40 bg-teal/10 px-3 py-1 font-mono text-[11px] text-teal">
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
                onClick={() => loadDemo(d.industry)}
                className="mt-5 text-sm font-semibold text-accent transition-colors hover:text-accent-glow"
              >
                Try a demo like this →
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
