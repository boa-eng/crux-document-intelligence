'use client'

// Doesn't touch component state, so it lives outside the component — keeps
// the function identity stable across renders instead of rebuilding it every time.
function scrollToTool() {
  document.getElementById('tool')?.scrollIntoView({ behavior: 'smooth' })
}

export function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-[100svh] flex-col items-center justify-center px-6 py-24 text-center"
    >
      {/* Content */}
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center">
        <p
          className="fade-up font-mono text-sm font-semibold uppercase tracking-[0.2em] text-accent"
          style={{ animationDelay: '0ms' }}
        >
          Crux
        </p>

        <h1
          className="fade-up mt-4 font-heading text-[44px] font-semibold leading-[1.05] tracking-tight text-balance md:text-7xl"
          style={{ animationDelay: '50ms' }}
        >
          {/* two-tone treatment: text unchanged, just split at the natural
              phrase break so the headline gets some visual hierarchy */}
          <span className="text-foreground">Ask your documents </span>
          <span className="text-muted-foreground">anything.</span>
        </h1>

        <p
          className="fade-up mt-6 text-lg font-medium text-muted-foreground md:text-xl"
          style={{ animationDelay: '100ms' }}
        >
          Every answer comes with the source.
        </p>

        <div
          className="fade-up mt-10 flex flex-col items-center gap-4 sm:flex-row"
          style={{ animationDelay: '150ms' }}
        >
          <button
            type="button"
            onClick={scrollToTool}
            className="group relative inline-flex items-center gap-2 rounded-lg bg-accent px-7 py-3.5 text-sm font-semibold text-accent-foreground transition-all duration-200 hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Ask your first question
            <span className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </button>
        </div>

        <p
          className="fade-up mt-4 text-sm text-muted-foreground"
          style={{ animationDelay: '175ms' }}
        >
          No account. Nothing stored.
        </p>
      </div>

      {/* Scroll indicator */}
      <button
        type="button"
        onClick={scrollToTool}
        aria-label="Scroll to the tool"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <svg
          className="bounce-chevron h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </section>
  )
}
