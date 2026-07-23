'use client'

import { useReveal } from './use-reveal'

/*
 * LED dot-matrix renderer (Supabase GitHub-counter style) for the stats row.
 *
 * A 5-row pixel font, defined ONLY for the characters "15/15" needs. Each
 * glyph is five strings of '1'/'0' — a '1' is a lit dot. Five rows is the
 * minimum height at which '5' keeps its distinctive top-bar/mid-bar/tail
 * shape; anything shorter reads as an 'S' or a blob at small dot sizes.
 */
const GLYPHS: Record<string, string[]> = {
  '1': ['010', '110', '010', '010', '111'],
  '5': ['1111', '1000', '1110', '0001', '1110'],
  '/': ['001', '010', '010', '010', '100'],
}

/* The unlit grid extends this many columns past the glyphs on each side.
   Why: the faint unlit dots around the numerals are what make this read as a
   physical LED display (a device with more pixels than the message needs)
   instead of clip-art digits — and they give the ambient flicker somewhere
   to live that never touches the numerals. */
const FIELD_PAD = 3

/* Build the full on/off grid for a string: pad columns, then each glyph's
   columns with one blank spacer column between glyphs, then pad again. */
function buildRows(text: string): string[] {
  const chars = Array.from(text).map((c) => {
    const g = GLYPHS[c]
    if (!g) throw new Error(`dot-matrix: no glyph for "${c}"`)
    return g
  })
  return Array.from({ length: 5 }, (_, r) =>
    '0'.repeat(FIELD_PAD) + chars.map((g) => g[r]).join('0') + '0'.repeat(FIELD_PAD),
  )
}

/*
 * Ambient flicker must be DETERMINISTIC: this component renders on the server
 * first, and Math.random() at render would make the server and browser pick
 * different dots — React would flag a hydration mismatch. Instead a fixed
 * arithmetic rule ((row * 31 + col) % 7 === 0, primes so the picks scatter
 * rather than stripe) selects a handful of dots, restricted to the padding
 * field so the numerals themselves never blink. Delay/duration come from the
 * same seed, so every visitor sees the identical gentle pattern.
 */
function flickerStyle(row: number, col: number, totalCols: number) {
  const inPad = col < FIELD_PAD || col >= totalCols - FIELD_PAD
  if (!inPad) return null
  const seed = row * 31 + col
  if (seed % 7 !== 0) return null
  return {
    animationDelay: `${(seed % 5) * 0.7}s`,
    animationDuration: `${3 + (seed % 3) * 0.8}s`,
  }
}

/**
 * Renders `text` as a grid of small rounded LED dots. Lit dots use the site's
 * warm ember; unlit dots are a faint warm-white texture. Sized to sit where a
 * text-4xl/5xl stat number would (see .dotmatrix in globals.css).
 */
export function DotMatrix({ text }: { text: string }) {
  // Reuse the site's in-view idiom: flicker animations only run while the
  // matrix is on screen (animation-play-state gate in globals.css), so an
  // off-viewport section costs nothing.
  const { ref, visible } = useReveal<HTMLDivElement>(0.2)
  const rows = buildRows(text)
  const totalCols = rows[0].length

  return (
    <div
      ref={ref}
      role="img"
      aria-label={text}
      className={`dotmatrix${visible ? ' is-visible' : ''}`}
      style={{ gridTemplateColumns: `repeat(${totalCols}, var(--dm-dot))` }}
    >
      {rows.flatMap((row, r) =>
        Array.from(row).map((bit, c) => {
          const flicker = bit === '0' ? flickerStyle(r, c, totalCols) : null
          return (
            <span
              key={`${r}-${c}`}
              className={
                bit === '1' ? 'dm-dot dm-lit' : flicker ? 'dm-dot dm-flicker' : 'dm-dot'
              }
              style={flicker ?? undefined}
            />
          )
        }),
      )}
    </div>
  )
}
