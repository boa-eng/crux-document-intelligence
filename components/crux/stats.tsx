'use client'

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center px-4 text-center">
      <span className="font-heading text-4xl font-bold tracking-tight text-accent md:text-5xl">
        {value}
      </span>
      <span className="mt-2 text-[13px] leading-snug text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

export function Stats() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto grid max-w-2xl grid-cols-2 gap-y-10 divide-x divide-border">
        <Stat value="4" label="Input types: text, documents, images, audio" />
        <Stat value="0 bytes" label="Stored by default" />
      </div>
    </section>
  )
}
