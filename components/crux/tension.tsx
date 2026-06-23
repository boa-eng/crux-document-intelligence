'use client'

import { useReveal } from './use-reveal'

const LINES = [
  'The answer is in there.',
  'Buried in there, somewhere.',
  'You don’t have time to look.',
]

export function Tension() {
  const { ref, visible } = useReveal<HTMLDivElement>(0.2)

  return (
    <section className="px-6 py-28 md:py-40">
      <div ref={ref} className="mx-auto max-w-4xl text-center">
        <h2 className="font-heading font-extrabold leading-[1.15] tracking-tight text-balance" style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}>
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
          So Crux reads it for you. And shows you exactly where.
        </p>
      </div>
    </section>
  )
}
