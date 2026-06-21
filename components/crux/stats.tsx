'use client'

import { useCountUp } from './use-reveal'

function CountStat({
  target,
  prefix = '',
  suffix = '',
  label,
}: {
  target: number
  prefix?: string
  suffix?: string
  label: string
}) {
  const { ref, value } = useCountUp(target)
  return (
    <div className="flex flex-col items-center px-4 text-center">
      <span
        ref={ref}
        className="font-heading text-4xl font-bold text-accent md:text-5xl"
      >
        {prefix}
        {value}
        {suffix}
      </span>
      <span className="mt-2 text-[13px] leading-snug text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

function TextStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center px-4 text-center">
      <span className="font-heading text-4xl font-bold text-accent md:text-5xl">
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
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-y-10 divide-border md:grid-cols-4 md:divide-x">
        <CountStat target={200} suffix="+" label="File types & sizes" />
        <CountStat
          target={15}
          prefix="<"
          suffix=" sec"
          label="Average answer time"
        />
        <TextStat value="Every" label="Answer cites its source" />
        <TextStat value="Zero" label="Data stored" />
      </div>
    </section>
  )
}
