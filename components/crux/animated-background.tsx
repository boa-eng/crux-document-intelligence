'use client'

// The glow blobs and floating particles this component used to render were
// switched off (display: none, see globals.css) during the Paper & Ink
// redesign — calmer direction, no drifting motion behind the page. Only the
// faint dot grid remains visible, so that's all we render now.
export function AnimatedBackground() {
  return (
    <div className="crux-bg" aria-hidden="true">
      <div className="crux-bg__grid" />
    </div>
  )
}
