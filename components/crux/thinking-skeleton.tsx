'use client'

/**
 * Loading state shown while Crux is "reading". A warm shimmer sweeps over
 * three ghost lines, the way Linear/Vercel telegraph work-in-progress.
 * Replaces the breathing orb so the wait feels like an answer forming.
 */
export function ThinkingSkeleton({ fading }: { fading?: boolean }) {
  return (
    <div
      className="flex flex-col items-start gap-2 transition-opacity duration-300"
      style={{ opacity: fading ? 0 : 1 }}
      role="status"
      aria-label="Crux is thinking"
    >
      <div className="w-full max-w-[85%] space-y-2.5 rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-4">
        <div className="skeleton-line h-2.5 w-[92%]" />
        <div className="skeleton-line h-2.5 w-[80%]" />
        <div className="skeleton-line h-2.5 w-[58%]" />
      </div>
      <span className="sr-only">Generating answer…</span>
    </div>
  )
}
