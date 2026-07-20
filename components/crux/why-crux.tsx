'use client'

import { useReveal } from './use-reveal'

const VALUES = [
  'Answers in seconds, not hours.',
  'Every answer, traced to its source.',
  'Your documents vanish the moment you leave.',
]

export function WhyCrux() {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <section className="px-6 py-24">
      <div
        ref={ref}
        className={`mx-auto max-w-2xl text-center reveal ${visible ? 'is-visible' : ''}`}
      >
        <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-balance md:text-4xl">
          {/* two-tone treatment: text unchanged, just split at the sentence
              break so the headline gets some visual hierarchy */}
          <span className="text-foreground">Your team already wrote the answer.</span>{' '}
          <span className="text-muted-foreground">Crux remembers where.</span>
        </h2>
        <div className="mt-10 flex flex-col gap-4">
          {VALUES.map((v) => (
            <p
              key={v}
              className="text-lg font-medium leading-relaxed text-muted-foreground"
            >
              {v}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}
