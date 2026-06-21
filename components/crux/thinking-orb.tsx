'use client'

export function ThinkingOrb({ fading }: { fading?: boolean }) {
  return (
    <div
      className="flex items-center gap-3 transition-opacity duration-300"
      style={{ opacity: fading ? 0 : 1 }}
      aria-label="Crux is thinking"
      role="status"
    >
      <div className="relative">
        {/* outer glow pulses in sync via the same keyframes */}
        <div className="thinking-orb" />
      </div>
      <span className="sr-only">Generating answer…</span>
    </div>
  )
}
