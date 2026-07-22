// A quiet one-row answer to "is this for people like me?" — seven document-heavy
// fields as non-interactive pill chips. Deliberately low emphasis: hairline
// borders, muted mono text, no hover states, no links. It should register in
// peripheral vision, not compete with the sections around it.
const INDUSTRIES = [
  'Real estate',
  'Engineering teams',
  'Recruitment',
  'Legal',
  'E-commerce',
  'Medical',
  'Compliance',
]

export function IndustryStrip() {
  return (
    // section-seam closes the stats+industry compact band as ONE unit — the
    // seam sits after the pills, never between stats and this strip
    <section className="section-seam px-6 pb-16">
      {/* max-w-4xl (not 3xl): seven pills need ~800px, so the wider rail keeps
          them on one line at desktop instead of orphaning the last pill. */}
      <ul className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2">
        {INDUSTRIES.map((name) => (
          <li
            key={name}
            className="rounded-full border border-border px-3.5 py-1.5 font-mono text-xs tracking-wider text-muted-foreground"
          >
            {name}
          </li>
        ))}
      </ul>
    </section>
  )
}
