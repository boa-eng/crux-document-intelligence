'use client'

import { useReveal } from './use-reveal'

const LINES = [
  'A 200-PAGE CONTRACT.',
  "A POLICY YOU CAN'T SEARCH.",
  'A QUESTION NO ONE CAN ANSWER FAST ENOUGH.',
]

export function Tension() {
  const { ref, visible } = useReveal<HTMLDivElement>(0.2)

  return (
    <section className="px-6 py-28 md:py-40">
      <div ref={ref} className="mx-auto max-w-4xl text-center">
        <h2 className="font-heading text-3xl font-extrabold leading-[1.15] tracking-tight text-balance md:text-5xl">
          {LINES.map((line, i) => (
            <span
              key={i}
              className="block transition-all duration-700"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(16px)',
                transitionDelay: `${i * 200}ms`,
              }}
            >
              {line}
            </span>
          ))}
        </h2>
        <p
          className="mt-8 text-lg font-medium text-muted-foreground transition-all duration-700"
          style={{
            opacity: visible ? 1 : 0,
            transitionDelay: `${LINES.length * 200}ms`,
          }}
        >
          Crux is what serious teams use when the answer has to be right.
        </p>
      </div>
    </section>
  )
}
