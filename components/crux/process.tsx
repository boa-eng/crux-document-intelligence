'use client'

import { useReveal } from './use-reveal'

const STEPS = [
  {
    n: '01',
    title: 'UPLOAD',
    body: 'Drop in any document — contract, handbook, policy, report. Crux reads every word.',
    dir: 'left' as const,
  },
  {
    n: '02',
    title: 'ASK',
    body: "Type your question exactly as you'd say it. No keywords. No syntax. Just ask.",
    dir: 'right' as const,
  },
  {
    n: '03',
    title: 'TRUST',
    body: 'Every answer shows the exact page it came from. Verify in one click.',
    dir: 'left' as const,
  },
]

function Step({ step }: { step: (typeof STEPS)[number] }) {
  const { ref, visible } = useReveal<HTMLDivElement>(0.25)
  const base = step.dir === 'left' ? 'reveal-left' : 'reveal-right'
  return (
    <div
      ref={ref}
      className={`flex flex-col items-center gap-4 text-center md:flex-row md:gap-10 md:text-left ${
        step.dir === 'right' ? 'md:flex-row-reverse md:text-right' : ''
      } ${base} ${visible ? 'is-visible' : ''}`}
    >
      <span className="font-heading text-6xl font-extrabold text-accent md:text-7xl">
        {step.n}
      </span>
      <div className={step.dir === 'right' ? 'md:items-end' : ''}>
        <h3 className="font-heading text-2xl font-bold tracking-tight">
          {step.title}
        </h3>
        <p className="mt-2 max-w-md text-base leading-relaxed text-muted-foreground">
          {step.body}
        </p>
      </div>
    </div>
  )
}

export function Process() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto flex max-w-3xl flex-col gap-16">
        {STEPS.map((s) => (
          <Step key={s.n} step={s} />
        ))}
      </div>
    </section>
  )
}
