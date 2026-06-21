'use client'

const PARTICLES = [
  { left: '12%', top: '30%', delay: '0s', duration: '22s' },
  { left: '28%', top: '70%', delay: '6s', duration: '28s' },
  { left: '55%', top: '20%', delay: '3s', duration: '25s' },
  { left: '72%', top: '60%', delay: '9s', duration: '30s' },
  { left: '85%', top: '40%', delay: '2s', duration: '26s' },
  { left: '42%', top: '85%', delay: '12s', duration: '24s' },
]

export function AnimatedBackground() {
  return (
    <div className="crux-bg" aria-hidden="true">
      <div className="crux-bg__glow crux-bg__glow--a" />
      <div className="crux-bg__glow crux-bg__glow--b" />
      <div className="crux-bg__grid" />
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="crux-particle"
          style={{
            left: p.left,
            top: p.top,
            animation: `float-particle ${p.duration} linear ${p.delay} infinite`,
          }}
        />
      ))}
    </div>
  )
}
