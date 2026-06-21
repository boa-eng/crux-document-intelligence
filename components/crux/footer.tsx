const LINKS = ['Engine', 'Self-host', 'Security', 'Source']

export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
        <span className="font-heading text-2xl font-extrabold text-accent">
          Crux
        </span>
        <p className="text-sm text-muted-foreground">
          Built for teams who can&apos;t afford wrong answers.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <a
              key={l}
              href="#"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
