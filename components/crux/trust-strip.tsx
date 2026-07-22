// Supabase-style two-weight trust items: the claim word carries bright ivory,
// a trailing qualifier (when one naturally exists) stays muted. Items with no
// natural claim/qualifier split render fully bright. Rendered text is
// byte-identical to the old flat strings — this is weighting, not rewording.
const ITEMS: { claim: string; qualifier?: string }[] = [
  { claim: 'Processed in memory' },
  { claim: 'Deleted', qualifier: 'on close' },
  { claim: 'Open-source engine' },
  { claim: 'NDA', qualifier: 'on request' },
  { claim: 'Self-hostable' },
]

export function TrustStrip() {
  return (
    <section className="border-y border-border bg-surface/50 px-6 py-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
        {ITEMS.map((item, i) => (
          <span
            key={item.claim}
            className="flex items-center gap-4 font-mono text-xs tracking-wider text-foreground"
          >
            <span>
              {item.claim}
              {item.qualifier && (
                <span className="text-muted-foreground"> {item.qualifier}</span>
              )}
            </span>
            {i < ITEMS.length - 1 && (
              // separator stays muted so the bright claims do the talking
              <span className="text-muted-foreground/60" aria-hidden="true">
                ·
              </span>
            )}
          </span>
        ))}
      </div>
    </section>
  )
}
