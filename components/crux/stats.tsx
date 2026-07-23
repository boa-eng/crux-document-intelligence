'use client'

import { DotMatrix } from './dot-matrix'

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center px-4 text-center">
      <span className="font-heading text-4xl font-bold tracking-tight text-accent md:text-5xl">
        {value}
      </span>
      {/* every label gets the same max width, balanced wrapping, and a
          two-line minimum height — so a short label and a long label occupy
          the same box and the three columns bottom out at the same y. */}
      <span className="mt-2 min-h-[2lh] max-w-[26ch] text-balance text-[13px] leading-snug text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

// Weird-specific beats round-generic: these three are real measured results
// from testing the deployed engine, not marketing rounding. 15/15 = the full
// question battery against dangote.pdf (108 pages). 3 = distinct technical
// standards pulled together in one cross-document question (the API 570/510
// run). 0 = the grounding rule: no citation, no claim.
export function Stats() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-y-10 sm:grid-cols-3 sm:divide-x sm:divide-border">
        {/* the first stat's number renders as an LED dot-matrix instead of
            serif text. The flex wrapper pins the matrix to the exact line
            box the other numbers occupy (40px at text-4xl, 48px at md's
            text-5xl) so all three labels keep sharing a baseline. */}
        <Stat
          value={
            <span className="flex h-10 items-center md:h-12">
              <DotMatrix text="15/15" />
            </span>
          }
          label="Answers verified against a 108-page financial report"
        />
        <Stat
          value="3"
          label="Technical standards cross-checked in one question"
        />
        <Stat
          value="0"
          label="Answers without a source. If it can't cite it, it says so."
        />
      </div>
    </section>
  )
}
