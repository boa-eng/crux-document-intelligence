'use client'

import { useReveal } from './use-reveal'

// Doesn't touch component state, so it lives outside the component — keeps
// the function identity stable across renders instead of rebuilding it every time.
function scrollToTool() {
  document.getElementById('tool')?.scrollIntoView({ behavior: 'smooth' })
}

export function FinalCta() {
  const { ref, visible } = useReveal<HTMLDivElement>()

  return (
    <section id="contact" className="px-6 py-28">
      <div
        ref={ref}
        className={`mx-auto max-w-2xl text-center reveal ${visible ? 'is-visible' : ''}`}
      >
        <h2 className="font-heading text-4xl font-extrabold leading-[1.1] tracking-tight text-balance md:text-5xl">
          Don&apos;t take our word for it.
        </h2>
        <p className="mt-5 text-lg font-medium leading-relaxed text-muted-foreground">
          Bring your hardest document. Ask your hardest question.
        </p>

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={scrollToTool}
            className="group relative inline-flex items-center gap-2 rounded-lg bg-accent px-7 py-3.5 text-sm font-semibold text-accent-foreground transition-all duration-200 hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Drop a document, ask a hard question
            <span className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </button>
        </div>

        {/* risk-reversal rows: every reason NOT to click, answered before the
            visitor thinks of it. Quiet check rows, deliberately smaller than
            the button so they read as reassurance, not a second pitch. The list
            is a width-fitted block centered as a group, with rows left-aligned
            inside it — so the checkmarks stack in one vertical line instead of
            each row centering independently. */}
        <ul className="mx-auto mt-8 flex w-fit max-w-md flex-col items-start gap-2 text-left">
          {[
            'Try it on your own documents. Right now, in this page.',
            'Nothing uploaded to storage. Files die when the tab does.',
            'No account. No card. No call.',
          ].map((line) => (
            <li
              key={line}
              className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground"
            >
              <svg
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden="true"
              >
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
