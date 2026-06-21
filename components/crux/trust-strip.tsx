const ITEMS = [
  'Processed in memory',
  'Deleted on close',
  'Open-source engine',
  'NDA on request',
  'Self-hostable',
]

export function TrustStrip() {
  return (
    <section className="border-y border-border bg-surface/50 px-6 py-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
        {ITEMS.map((item, i) => (
          <span
            key={item}
            className="flex items-center gap-4 font-mono text-xs tracking-wider text-muted-foreground"
          >
            {item}
            {i < ITEMS.length - 1 && (
              <span className="text-border" aria-hidden="true">
                ·
              </span>
            )}
          </span>
        ))}
      </div>
    </section>
  )
}
