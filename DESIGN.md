# Crux dark-glass design language

The tool widget is the engine room. The landing page is paper. Crossing from
one into the other should feel like stepping through a doorway: warm near-black
ink, one frosted-glass moment, light used sparingly as glow.

Everything below is scoped to the `.tool-dark` class on `<section id="tool">`.
Nothing outside that subtree changes. Ever.

## Base palette (the ink)

Warm, not neutral. Browns under the black, matching the paper page's warmth.

| Token | Value | Role |
|---|---|---|
| `--tool-bg` | `#191512` | outer slab. The darkest thing on the page |
| `--tool-surface` | `#211C18` | cards, popovers, modals inside the slab |
| `--tool-glass` | `rgba(33, 28, 24, 0.55)` | frosted surfaces (composer, chips, source panel) |
| `--tool-border` | `rgba(255,255,255,0.08)` | default hairline |
| `--tool-border-strong` | `rgba(255,255,255,0.14)` | lifted panes, focus-adjacent edges |
| `--tool-fg` | `#F2EDE6` | primary text. Warm cream, not pure white |
| `--tool-fg-muted` | `#A89F93` | meta text, timestamps, placeholders |

## How the scoping works

`tool.tsx` reads the site's semantic tokens (`--card`, `--border`,
`--foreground`, `--muted-foreground`, `--teal`, `--warn`). Inside `.tool-dark`
those tokens are re-pointed at the dark values above, so chips, popovers, the
gaps modal and feedback UI go dark without touching classNames. Prefer this
over scattering literal colors in TSX.

**Circularity trap:** never define a re-pointed token from itself. `--teal:
var(--teal-bright)` where `--teal-bright` mixes `var(--teal)` is a circular
custom-property reference. The browser silently discards both and the color
collapses to near-black. Mix the bright variants from literal root values and
keep them in sync by hand.

## Accent rules (the one strict contrast rule)

- `--accent` (`#7A2E48` burgundy) stays untouched. It is only ever a solid
  button fill paired with `--accent-foreground` text (~8:1, passes anywhere).
- Accent as TEXT or BORDER directly on the ink must use `--accent-bright`
  (`color-mix(in srgb, var(--accent) 60%, white)`). Solid burgundy on ink is
  ~2:1. Illegible. Same rule for teal and warn: `--teal-bright`,
  `--warn-bright` whenever they sit on the ink as text or icon.
- Targeted selectors in `globals.css` (`.tool-dark .text-accent`, focus/hover
  variants, `ring-accent`) do this lift so TSX classNames stay unchanged.
- Text on ink must stay WCAG-ish: body text near 4.5:1 minimum, meta text can
  sit a little under but never below ~4:1.

## Glass treatment

One family, three members. Recipe: `--tool-glass` background +
`backdrop-filter: blur(10–20px)` + a border from the border scale.

- **Composer** (`.tool-composer`): the hero. Strongest blur (20px), strong
  border, plus a faint accent radial from the top-left corner so it looks lit
  from within. Focus brightens the border to `--accent-bright`.
- **Source passage panel** (`.source-panel`): same glass, 16px blur, strong
  border, deep soft black drop shadow (`0 18px 40px -18px rgba(0,0,0,0.7)`).
  Light-page Tailwind shadows (`shadow-lg`) read as grey smears on ink. Replace
  them, never stack them.
- **Citation chips** (`.citation-stamp`): small glass pills, 10px blur, hairline
  border, `--accent-bright` text.

## Glow restraint

Glow is a whisper, not neon. Only citation chips glow (`0 0 16px -4px` of
accent-bright at 45%, slightly stronger on hover), because citations are the
product's proof and deserve the one highlight. Nothing else gets an outer glow.
The composer's "glow" is an inner tint, not a halo. If two things glow at once,
one of them is wrong.

## What stays untouched

- Everything outside `<section id="tool">`: paper/burgundy landing page, nav,
  footer.
- Root token values in `:root`. Dark equivalents live only inside `.tool-dark`.
- Layout and behavior: panel-above-chips placement, click-outside-to-close,
  scroll pinning. Style them in place, never move them.
- `color-scheme: dark` on `.tool-dark` handles native scrollbars and form
  controls for free. Don't hand-style scrollbars.

## Working notes

- Prefer extending `.tool-dark` scoped hooks in `app/globals.css` over literal
  colors in `tool.tsx`. A small className hook (like `source-panel`) is fine
  when no token path exists.
- Every hook gets a plain-English "why" comment. The codebase is human-reviewed.
- The dev server (Turbopack) can serve a stale CSS compile after branch
  switches. If `.tool-dark` rules seem missing at runtime, make a real content
  edit to `globals.css` to force a recompile before debugging further.
- Playwright MCP tends to be down; a file-command daemon (`scratchpad/driver.js`
  + `send.sh`) drives the cached chromium-1228 across shell calls, keeping ONE
  live page so state survives CSS hot-reloads. Reuse it for screenshots.

## Working notes — Tier-2 chat layout pass (2026-07-21)

- **User pill is now glass, not a fill.** `.tool-dark .tool-bubble` was a heavy
  `color-mix(accent 45%)` fill; it's now the Part-2 glass recipe (0.05–0.09 warm-
  white gradient + blur/saturate + inset top rim). The JSX still carries
  `bg-accent text-accent-foreground`; we override the fill in CSS (same pattern as
  the rest of `.tool-dark`) and keep the near-white text, which stays high-contrast
  on the dark pill. A `@supports not (backdrop-filter)` fallback keeps it a solid
  warm surface where blur is unsupported. Assistant answers already had no bubble
  (plain text on ink) — that half was done; this pass only bumped markdown headings
  to 15px (one step over the 14px body) and widened turn spacing to `space-y-6`.
- **Citation stacking is pure frontend grouping.** `MessageBubble` groups the flat
  `message.sources` by filename (`sourceGroups` useMemo), preserving the backend's
  most-relevant-first order — so the FIRST passage per file is what the chip labels,
  and the rest page behind it. Decision: preserve appearance order, NOT numeric page
  sort, so the chip always shows the strongest hit (Perplexity-style). The backend
  contract is untouched — `toHistoryItem` still rebuilds `file · p. N` labels from
  the same flat `sources`, so the "which page did that come from?" follow-up keeps
  working. Panel state moved from `openSourceIdx` (flat index) to
  `openGroup` + `pageInGroup`; the ‹ › pager clamps (disabled at ends) rather than
  wrapping. Single-page docs render exactly as before (no pager, one passage).
  **REVERTED (2026-07-23): the user overruled the grouping** — the "+K" suffix
  read as cryptic and hid sources. Every citation now renders its own chip
  ("file · p. N" each, wrapping; backend caps at 6), one chip opens one passage,
  the ‹1/N› pager is gone, and panel state is back to a single open index
  (`openSourceIdx`). The animated open/close, Esc/click-outside, and the overlap
  highlight all survived the un-stacking. Don't re-group.
- **Overlap highlight (the bonus) shipped.** `overlapSpan()` finds the longest run
  of ≥4 consecutive words shared between the passage and the answer and returns its
  char span in the ORIGINAL passage; `HighlightedSnippet` wraps it in `.crux-hl`
  (subtle accent wash, not neon). Cheap O(n²)-over-snippet-tokens heuristic; falls
  back to plain text when there's no ≥4-word run, so paraphrased answers never look
  broken. Number/₦ tokens split on `[A-Za-z0-9]+`, which is why runs like "rose to
  2 1 trillion in the period" still match across "₦2.1".
- **Empty-state suggestion chips shipped; composer was NOT re-centered.** Chips
  ("Summarize this document", "What are the key figures?", "Compare the uploaded
  files" only when >1 file) appear once a doc is uploaded and fill the composer via
  the existing `editMessage` helper. Deliberately did NOT relocate the composer to
  screen-center-then-dock: it lives in a fixed bottom `border-t` slot and moving it
  is a structural layout change that risked destabilizing the (higher-priority)
  message/citation work. Left for a future pass if wanted.
- **Backend quirk observed, not caused by this pass:** the one real
  "Summarize the key financial figures…" question against dangote.pdf returned a
  grounded answer with a single page-less `dangote.pdf` citation and an EMPTY answer
  body (0 chars streamed). The streaming/drip path is untouched here, so this is a
  backend/retrieval artifact worth a look independently. Chip-stacking + paging + the
  plain-assistant screenshots were taken against a temporary in-`useState` mock
  message (removed after; confirmed via git diff).

## Working notes — motion polish + dark landing pass (2026-07-22)

- **Popover exit motion (the Esc fix).** React unmounts a panel the instant its
  state clears, so closes were a light switch. `useDelayedUnmount(open, ms=180)`
  in `tool.tsx` fixes this: when `open` flips false the element stays `mounted`
  for the CSS exit's length with `closing: true`, and the caller swaps
  `.popover-in` → `.popover-out` (globals.css: enter = 200ms ease-out fade +
  6px rise + scale-from-0.98; exit = 170ms ease-in fade + 5px drift down +
  scale-to-0.98, macOS-popover style, with `pointer-events: none` so a closing
  panel can't eat clicks). Because every close path (Esc, click-outside, chip
  re-click) only ever sets the open state, they ALL route through the animation
  with no per-path work. Reduced-motion users get a 0ms timeout — instant
  unmount, exactly the old behavior. Wired to the source-passage panel and the
  downvote "what went wrong" popover; the panel latches its last open group in
  a ref (`renderGroup`) so the closing pane keeps its content instead of going
  blank mid-fade. The click-away scrim under the downvote popover renders only
  while truly open, never during the closing phase.
- **Hover feel.** `.citation-stamp`, `.source-panel`, and a new `.tool-chip`
  hook (header buttons + empty-state suggestion chips) transition background/
  border/box-shadow/color together at 150ms ease-out so no property snaps.
  Hovers brighten fill/edge only — blur never changes. The `.tool-chip` hover
  fill is mixed FROM `--tool-surface` (91% surface / 9% white), not a
  translucent white, because the suggestion chips already sit on a surface
  fill and a 5% white overlay landed on the same color (invisible hover).
  Panel scrollbar was already correct via `color-scheme: dark` — untouched.
- **Dark landing: scope decision = promote the ink palette to `:root`** (this
  branch only), NOT a `.page-dark` wrapper. Every landing component already
  reads the semantic tokens, so one `:root` block flips the whole page;
  `.tool-dark` still re-points the same tokens inside the widget so its tuned
  values keep winning. Page base `#141110` sits a step darker than the widget
  slab `#191512` so the tool reads lifted, and `.tool-card` gained an inset
  top rim (1px white @ 6%) because a black drop shadow alone can't separate
  ink from ink. Root-level `.text-accent` / `hover:border-accent/40` /
  `ring-accent/40` lifts mirror the `.tool-dark` ones (solid burgundy on ink
  is ~2:1); `--teal`/`--warn` are bright-mixed at root FROM LITERALS (the
  circularity trap note still applies). `--accent` untouched: still the solid
  CTA fill.
- **Backdrop depth:** `.crux-bg` carries two static radial glows (accent-bright
  9% top-left under the hero, teal 7% mid-right by the tool) so the glass has
  something to refract; the grain overlay flipped `multiply` → `screen` (grain
  must add light on ink) and the dot grid flipped to light dots. No looping
  animation anywhere. `.glass` (sticky bar) is now dark frost: rgba(25,21,18,.6)
  + blur(16px) saturate(160%) + inset top rim, with a solid-ink
  `@supports not (backdrop-filter)` fallback.
- **One-off retunes:** ProofPanel's spotlight went from cool `#1A1D21` (its
  contrast came from the paper page) to a warm LIGHTER-than-card `#26201A` so
  it still reads as a spotlight on ink; `layout.tsx` viewport colorScheme/
  themeColor now dark. All copy strings untouched; reveal/fade-up animations
  untouched. Contrast on the new base: `--foreground` ~15:1, `--muted-
  foreground` ~7.3:1 on bg / ~6.6:1 on card, `--accent-bright` ~5.8:1 — all
  clear of the 4.5:1 floor. On `main` none of this exists; nothing here is
  shared beyond this branch's globals.css/layout/proof-panel edits.

## Working notes — depth finish + conversion sections (2026-07-22, second pass)

- **Background presence fixed by roughly doubling the glows.** The 9%/7%
  radials read as flat black at normal brightness (the exact glass-over-flat
  anti-pattern). Now: accent 18% at 16%/8% (70rem), teal 14% at 92%/42%
  (72rem), plus a NEW third warm ember (#B2762E at 8%) low-center under the
  CTA. Still soft 70% falloff, still static. If a future pass thinks these are
  loud, check at laptop brightness before dimming: at 9% they were invisible.
- **`.tool-card` slab now separates three ways:** fill stepped up to `#1b1713`
  (page base #141110, old slab token #191512 — the `--tool-bg` token itself is
  UNCHANGED and still feeds nothing else, the slab uses the literal); top rim
  raised to 12% white; and a `0 0 0 1px rgba(255,255,255,0.06)` spread shadow
  acts as the outer border-light. Deliberately a box-shadow ring, NOT a
  border-color override: the dragOver state swaps the element's real border to
  `border-accent`, and an unlayered `.tool-card { border-color }` rule in
  globals.css would beat that utility and kill the drag affordance.
- **Empty-state dropzone got a real zone** (tool.tsx): the icon + "Drop a
  document here" + privacy line now sit inside a dashed
  `--tool-border-strong` hairline with a 3% foreground fill lift. Instruction
  line lifted muted→`text-foreground/90` font-medium; privacy line to full
  muted (was /80); suggestion chips to `text-foreground/80`. This is the one
  place the "layout untouched" rule flexed: a wrapper div around three
  existing empty-state elements, nothing else moved.
- **New conversion sections, all opaque ink (glass stays on tool chrome):**
  `why-crux.tsx` reworked into the 3-column category-defense grid (Ctrl+F /
  Chatbots / Crux; Crux favored via accent-bright 45% rim + `-translate-y-1.5`
  + deep drop); `stats.tsx` now carries the three MEASURED numbers (15/15
  dangote battery, 3 standards in the API 570/510 run, 0 uncited answers) in a
  3-col grid; `industry-strip.tsx` (new, after Stats) is a non-interactive
  mono pill row; `pricing-anatomy.tsx` (new, before FinalCta) is the
  two-card fee anatomy with zero prices, Teams favored with the same rim
  treatment as the Crux column so "favored" has one visual voice site-wide.
  `final-cta.tsx` gained three teal-check risk-reversal rows under the button;
  the pre-existing mono line below them is byte-identical per the copy freeze,
  so "No account" now appears twice in that section — flagged, not fixed.
- No mock message state was needed this pass; the tool widget's internals are
  untouched beyond the empty-state block. Zero backend calls made.

## Working notes — fix pass 2: dedupe + alignment + glass amplification (2026-07-22)

- **CRITICAL COMPILER TRAP (root-caused this pass): the CSS pipeline
  (Tailwind v4 / Lightning CSS under Turbopack) folds a
  `backdrop-filter` + `-webkit-backdrop-filter` pair into ONE logical
  declaration and emits only the LAST-written form.** Every glass rule in
  globals.css was written standard-first / -webkit-second, so the compiled CSS
  contained ONLY `-webkit-backdrop-filter` — which desktop Chrome ignores.
  All blur on the site (sticky bar, composer, user pill, citation chips,
  source panel) was silently dead in Chrome; the "glass" was just low-alpha
  fills. Fix: always write `-webkit-backdrop-filter` FIRST and the standard
  `backdrop-filter` LAST (the order Tailwind's own utilities use — both then
  survive). Writing only the standard property does NOT work either; the
  compiler rewrites it to -webkit-only. Verified by curling the compiled
  chunk and reading `getComputedStyle(...).backdropFilter` at runtime.
- **Sticky bar amplified into the real macOS moment:** fill is now a
  top-heavy gradient (rgba(20,17,14) 0.7 → 0.3) instead of the near-solid
  0.6 flat — the darker top IS the text-contrast dim layer (wordmark/CTA sit
  there), while the thinner bottom half lets scrolling content visibly ghost
  through blur(20px) saturate(180%). Second inset rim added along the BOTTOM
  edge (the edge content slides beneath) alongside the top specular.
- **Slab specular ring:** `.tool-card::before` = the pass-1 masked-ring
  recipe (1px padding, xor mask), gradient 22% white at top → 2% at bottom,
  so the slab reads as a pane lit from above. Drawn as an overlay ring, NOT
  the element border, so the dragOver `border-accent` swap underneath still
  works; `pointer-events: none` so drag/drop events pass through.
  `.tool-card` gained `position: relative` to anchor it.
- **Lit-from-above vocabulary on content cards:** why-crux / pricing /
  testimonials cards each got `inset 0 1px 0 rgba(255,255,255,0.06)` folded
  into their Tailwind shadow utilities (kept in TSX, not a CSS class — a
  plain-class box-shadow would fight the arbitrary shadow utilities on the
  favored cards). Opaque fills, no blur, no glow, per the glass-on-chrome rule.
- **Alignment pass:** why-crux + pricing cards are `flex h-full flex-col` in
  `items-stretch` grids (equal heights); why-crux headings sit in a
  min-h-[1.75rem] row so one-liners start at one y. Stats labels got
  `min-h-[2lh] text-balance` so 2-line and 3-line labels occupy one box.
  Final-CTA check rows: `w-fit mx-auto items-start` — group stays centered,
  checkmarks stack in one vertical line. "Pricing on request." moved mt-8→10.
  The favored cards keep their deliberate `-translate-y-1.5` lift, so their
  content sits 6px high by design — that offset is the "favored" voice, not
  a misalignment.
- **Copy changes (user-approved):** the duplicate final-CTA mono line ("NO
  ACCOUNT. NOTHING STORED...") is DELETED — the check rows carry that message
  now. Industry strip gained 'Medical' (7 pills) and widened its rail to
  max-w-4xl so all seven sit on one desktop line (3xl orphaned the last pill);
  wraps 2/3/2 centered at 390px.
- Screenshots via Playwright MCP (it was up this session; no driver daemon
  needed). Playwright's cwd is the rag-demo parent dir, so `filename:` saves
  land there — move them out so they don't pollute the repo.

## Working notes — typography rhythm + composer-as-hero pass (2026-07-22, third pass)

- **Chosen type scale (now the page law).** Section h2 = `font-heading
  text-3xl md:text-4xl font-bold leading-tight tracking-tight` (why-crux,
  proof-panel, pricing — proof-panel was missing the md:text-4xl step and got
  it). Deliberate exceptions that stay: tension (clamp 36–56 extrabold) and
  final-cta (text-4xl md:text-5xl extrabold) are the two emotional beats;
  hero h1 is the one 7xl. Mono kickers = `text-xs tracking-[0.25em]
  text-muted-foreground` (demos, testimonials). Card-title voice = ONE recipe
  everywhere: `font-heading text-lg font-bold tracking-tight` in a
  `min-h-[1.75rem]` row, body `mt-2 text-sm leading-relaxed muted` —
  pricing-anatomy was text-xl/p-7/mt-3 and is now normalized to the why-crux
  values (text-lg/p-6/mt-2). Card container recipe: `rounded-2xl p-6` +
  hairline + `inset 0 1px 0 white/6` lit-rim (why-crux + pricing were
  rounded-xl; demos was missing the rim — all aligned now). Section padding
  rhythm: `py-24` standard; py-28/40 tension + py-28 final-cta (beats),
  stats py-16 + industry pb-16 (one compact band), trust py-6 / footer py-12
  (bands). Rails: text sections 3xl/4xl, 3-col grids 5xl; proof-panel's odd
  `max-w-[1050px]` snapped to max-w-5xl.
- **Demo cards equal-height fix:** grid is `items-stretch`, each card
  `flex h-full flex-col`, and the source chip + "Try a demo like this" link
  live in one `mt-auto pt-4` footer block — so chips sit on one line and
  links on one baseline across all three cards regardless of answer length.
- **Composer chip structure (Copilot-style):** the document-aware suggestion
  chips moved INSIDE `.tool-composer`, as a `flex-wrap` row between the
  attached-file pills and the textarea (capped `max-h-[4.5rem] overflow-hidden`
  = two rows max). Six prompts (Summarize / key figures / compare-when->1-file /
  find-a-number-in-a-table / what's-missing / explain-hardest-simply), same
  `tool-chip` styling, same `editMessage` fill-on-click. They render only while
  `composerCentered` (doc uploaded, nothing sent), so they vanish with the
  first message — the old below-composer row is deleted. Empty-state hero
  treatment: centered slot gets `self-stretch md:-mx-2` (a touch wider than
  the message column), composer padding steps up `px-4 pb-3 pt-4`, textarea
  floors at `min-h-[76px]` (~3 lines). All of it keys off the existing
  `composerCentered` flag on the ONE composer instance, so the dock
  transition (compact px-3/pt-3, one-line input) is untouched.
- **Input niceties + highlight:** textarea now carries `spellCheck` /
  `autoCorrect="on"` / `autoCapitalize="sentences"` (native only, no LLM).
  `.crux-hl` strengthened: wash 18%→30% accent-bright, `font-weight: 600`,
  text pinned to `--tool-fg` — verified in the panel against a temporary mock
  message (removed after; confirmed via git diff). No copy strings changed
  anywhere in this pass.

## Working notes — Supabase quick-wins pass (2026-07-22, fourth pass)

- **Two-tone headline rule (now the page law): muted opening, bright payoff.**
  Section h2s split at their natural phrase break render the FIRST clause in
  `text-muted-foreground` and the SECOND (the payoff) in `text-foreground` —
  hierarchy from color alone, zero extra elements. Flipped why-crux and
  proof-panel (both were bright-first); tension's three stacked lines follow
  the same law (two setup lines muted, closing line bright). Single-clause
  headings with no natural split (pricing's "Two ways to run Crux.",
  final-cta's "Don't take our word for it.") stay fully bright — never force
  a split. Hero already had its own two-tone; untouched.
- **Section seam token:** `.section-seam` = `border-bottom: 1px solid
  rgba(255,250,245,0.07)` — warm white, NOT pure white (grey on warm ink).
  Applied on section roots: tension, industry-strip (closing the
  stats+industry band as one unit), demos, process, why-crux, proof-panel,
  testimonials, pricing-anatomy. Exempt: hero + tool (a hard line fights the
  slab's specular ring/shadow), trust-strip (has its own border-y), final-cta
  (the footer's border-t already draws that boundary). `.section-band` =
  `background-color: rgba(255,250,245,0.02)`, currently on demos only — one
  lighter band per scroll is enough rhythm.
- **Card hover recipe ("switch on"), one voice site-wide:** rest = hairline
  `--border` (8% white) + `inset 0 1px 0 white/6`; hover = border →
  `white/20` + inset top-light → `white/12`. `transition-[border-color,
  box-shadow] duration-150`, Tailwind default ease. NO translate, scale,
  shadow-grow, or spotlight. Favored cards (why-crux Crux, pricing Teams)
  keep their static `-translate-y-1.5` lift (positioning, not hover) and
  their drop shadow verbatim; their hover brightens the accent rim one step
  (45% → 65% accent-bright) plus the same top-light bump. Replaced the old
  `hover:border-accent/40 transition-colors duration-200` on demos +
  testimonial cards. Widget citation chips / tool-chips keep their own hover
  language — untouched.
- **Trust-strip two-weight:** claims in `text-foreground`, natural trailing
  qualifiers muted ("Deleted" bright / "on close" muted, "NDA" bright /
  "on request" muted); items with no natural split ("Processed in memory",
  "Open-source engine", "Self-hostable") stay all-bright. Separators (·) at
  `text-muted-foreground/60`. Rendered strings byte-identical to before.
- **Stale-CSS trap confirmed again this pass:** the new `.section-seam` /
  `.section-band` rules compiled only after a second real content edit to
  globals.css + a page reload — verify new classes via
  `getComputedStyle` before debugging selectors.

## Working notes — dot-matrix "15/15" stat (2026-07-22, fifth pass)

- **`components/crux/dot-matrix.tsx` (new, generic):** renders a string as an
  LED dot grid (Supabase GitHub-counter pattern). CSS grid of rounded `<span>`
  dots, not SVG — at ~135 dots a div grid is simpler and the glow is one
  box-shadow per lit dot. 5-row pixel font defined ONLY for '1'/'5'/'/'; the
  unlit field extends 3 columns past the glyphs each side so it reads as a
  device, not clip-art. `role="img" aria-label="15/15"` carries the number for
  screen readers.
- **Color:** lit dots = `color-mix(in srgb, #B2762E 60%, white)` — the CTA
  backdrop's warm ember run through the site's standard 60/40 bright-mix (the
  burgundy accent-bright read too dark for a "display"). Unlit = 5% warm white.
  Glow = one tight `0 0 6px` halo at 45% alpha per lit dot, nothing else.
- **Flicker is deterministic and gated.** A fixed arithmetic rule
  (`(row*31+col) % 7`) picks ~5 padding-field dots (never inside numerals);
  delays/durations derive from the same seed — no Math.random, so SSR and
  hydration agree. `animation-play-state: paused` until `useReveal` adds
  `.is-visible`; the global reduced-motion kill ends the 0.01ms one-shot on
  the 100% keyframe = unlit resting state, so reduced-motion users get a
  static lit number.
- **Sizing/alignment:** `--dm-dot`/`--dm-gap` = 5/3px (37px tall) stepping to
  6/4px at md (46px), wrapped in `h-10 md:h-12 flex items-center` inside the
  existing Stat value slot so it fills the exact line box of the text-4xl/5xl
  serif numbers and all three labels keep one baseline. `Stat`'s `value` prop
  widened to `React.ReactNode`; other two stats and all copy untouched.
- **Stale-CSS trap hit AGAIN:** the `.dotmatrix` rules served as
  `display: block` until a second content edit to globals.css + reload.
  Verify via `getComputedStyle` first, always.
- **REVERTED (2026-07-23).** The user judged the LED matrix non-uniform next
  to the plain serif "3" and "0" in the same row. "15/15" is back to the
  identical serif classes as the other two stat values; `dot-matrix.tsx` and
  the DOT MATRIX CSS section are deleted. Do NOT rebuild this — the note above
  stays only as a record of what was tried and why it lost.

## Working notes — smart per-document suggestion chips (2026-07-23)

- **Two-tier flow, one fallback chain: tier 2 > tier 1 > static.** The
  empty-state chips are no longer hardcoded. `/upload` now returns
  `suggestions` (tier 1: instant, LLM-free chips phrased from extracted
  section headings — `search.py: _extract_headings` + `heading_suggestions`,
  same heading-shape heuristic `section_query` relies on, plus junk filters
  for boilerplate/date-lines/table-rows). Right after upload the frontend
  fires ONE `POST /suggestions {session_id}` (tier 2:
  `RAGSearch.suggest_questions()`, a single LLM call over filenames +
  headings + first ~3 chunks per file capped at 4000 chars, defensively
  parsed to 4 questions). That endpoint never errors — any failure returns
  `{"suggestions": []}` so chips silently stay at the best tier reached.
- **Frontend upgrade-in-place** (`tool.tsx`): `suggestions` state (null =
  static fallback) + `suggestSeqRef`, a sequence token bumped on every
  upload/remove/clear so a slow tier-2 response for an old file set is
  discarded silently (chips are gone anyway once a message is sent — they
  only render while `composerCentered`). The chip row is keyed on the list
  content with the existing `.fade-in`, so a tier swap re-runs the fade —
  no spinner, chips just get smarter. Cap 5 visible; click still fills the
  composer via `editMessage`; styling untouched.
- Verified against dangote.pdf: tier 1 yields four "What does it say
  about …?" chips from real note headings; tier 2 (one live Qwen call)
  returned 4 doc-specific questions (market cap, Obajana renaming, revenue
  disaggregation, impairment). Fallback + upgrade paths exercised live on
  the running frontend (old backend 404s `/suggestions` → static chips
  hold; mocked 200 → chips swap in place).

---

# Part 2 — Liquid-glass material research (Apple HIG / WWDC25, CSS craft, Linear/Raycast/Vercel)

# Dark Liquid Glass — Research Brief (merge into DESIGN.md)

## Core principles

- **Glass is for the chrome layer only, never content.** Apple's hard rule: Liquid Glass lives on the floating navigation/control layer (composer, toolbars, chips); lists, messages, and documents stay opaque on the ink base. Why: glass-on-content destroys hierarchy and legibility.
- **Never stack glass on glass.** Glass cannot "sample" other glass; a popover over the composer gets a more opaque surface, not a second blur. Why: double blur reads as mud, and z-order becomes illegible.
- **Blur alone makes gray sludge — always pair with `saturate()`.** Gaussian blur averages colors toward gray; `saturate(140–180%)` restores chromatic depth. Why: this is the single biggest "cheap vs premium" differentiator on dark bases.
- **On dark ink, use white-alpha tints in the 0.04–0.10 range, not 0.15–0.25.** Light-theme glassmorphism recipes (12–25% white) glow like fog on dark. Keep the fill nearly invisible and let the blur + edge do the work.
- **The edge sells the glass.** A 1px top-lit border (brighter at top, fading at sides/bottom) simulates a specular rim catching light from above. Flat uniform borders read as plastic.
- **Depth via shadow-below + light-above, not glow everywhere.** On dark backgrounds, `box-shadow` darkens what's behind (large, soft, low-alpha black) while an inset top highlight lifts the panel. Reserve colored glow strictly for semantic accents (tint = meaning, e.g. primary action / active citation — never decoration).
- **4.5:1 text contrast measured after blur.** Apple's HIG minimum. Text on glass should be near-white (`rgba(255,255,255,0.92)`) or vibrant; if the backdrop is busy, add a dimming layer (~30% black) under the glass, not thicker glass.
- **Fallbacks are mandatory, not optional.** Reduced-transparency users get a frostier, near-opaque surface; no-`backdrop-filter` browsers get a solid tinted panel. The layout must never depend on the blur existing.

## CSS recipe box

```css
/* Tokens — warm dark ink base */
:root {
  --ink: #131110;                            /* warm near-black base */
  --glass-fill: rgba(255, 250, 245, 0.06);   /* warm white, barely there */
  --glass-edge: rgba(255, 255, 255, 0.12);
  --glass-edge-lit: rgba(255, 255, 255, 0.28);
  --accent: 30 90% 60%;                      /* warm amber, hsl parts */
}

/* 1. Glass panel on dark ink */
.glass-panel {
  background: var(--glass-fill);
  backdrop-filter: blur(16px) saturate(160%) brightness(1.1);
  -webkit-backdrop-filter: blur(16px) saturate(160%) brightness(1.1);
  border: 1px solid var(--glass-edge);
  border-radius: 16px;
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.45),                 /* depth below */
    inset 0 1px 0 rgba(255, 255, 255, 0.10);         /* specular top rim */
}

/* 2. Glass composer/input (heavier frost = higher hierarchy) */
.glass-composer {
  background: linear-gradient(
    rgba(255, 250, 245, 0.09), rgba(255, 250, 245, 0.05));
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid transparent;
  border-radius: 20px;
  background-clip: padding-box;
  position: relative;
}
.glass-composer::before {          /* edge-highlight ring, blur-safe */
  content: ""; position: absolute; inset: 0; border-radius: inherit;
  padding: 1px; pointer-events: none;
  background: linear-gradient(180deg,
    var(--glass-edge-lit), rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.02));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}

/* 3. Glowing accent chip (citations) — tint carries meaning */
.chip-citation {
  background: hsl(var(--accent) / 0.12);
  border: 1px solid hsl(var(--accent) / 0.35);
  color: hsl(30 90% 78%);
  border-radius: 999px;
  box-shadow: 0 0 12px hsl(var(--accent) / 0.15),
              inset 0 1px 0 hsl(var(--accent) / 0.20);
}
.chip-citation:hover  { background: hsl(var(--accent) / 0.18);
                        box-shadow: 0 0 20px hsl(var(--accent) / 0.25); }

/* 4. Hover/focus on glass: brighten fill + edge, never add blur */
.glass-panel:hover        { background: rgba(255, 250, 245, 0.09); }
.glass-composer:focus-within {
  outline: none;
  border-color: transparent;
  box-shadow: 0 0 0 1px hsl(var(--accent) / 0.4),
              0 0 24px hsl(var(--accent) / 0.12),
              0 12px 32px rgba(0,0,0,0.45);
}

/* 5. Optional grain: kills banding, adds physicality (keep <=3% opacity) */
.glass-panel::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit;
  pointer-events: none; opacity: 0.03; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,..."); /* tiny SVG feTurbulence tile */
}

/* 6. Fallbacks — solid surfaces, same geometry */
@supports not (backdrop-filter: blur(1px)) {
  .glass-panel, .glass-composer { background: rgba(30, 27, 25, 0.96); }
}
@media (prefers-reduced-transparency: reduce) {
  .glass-panel, .glass-composer {
    backdrop-filter: none; -webkit-backdrop-filter: none;
    background: rgba(30, 27, 25, 0.97);
  }
}
@media (prefers-reduced-motion: reduce) { /* kill shimmer/refraction anims */ }
```

**Performance rules:** never put `backdrop-filter` on `position: fixed` scroll-following elements in iOS Safari (repaints every frame — classic jank source); Safari can silently drop the filter if an opaque `background` shorthand overrides the rgba fill, and needs the `-webkit-` prefix. Cap blur at ~24px, limit simultaneous glass surfaces to 2–3, don't leave `will-change` set permanently. For large static regions (e.g. hero behind the widget), fake it with a pre-blurred image layer instead of live filter. Advanced polish (Josh Comeau): extend the backdrop element ~200% past the panel edge and clip with `mask-image` so the blur samples nearby content, avoiding color-flicker at edges; add `pointer-events: none` to the extension. Note `prefers-reduced-transparency` only landed in Chrome 118+, so also ship the `@supports` path and consider a manual "reduce glass" toggle.

## Steal-worthy exemplars

- **Linear (linear.app):** near-black base with 1px `rgba(255,255,255,0.06–0.08)` hairline borders doing ALL the panel separation (almost no background shifts), plus large off-screen radial color glows behind glass cards. Steal: hairlines-over-fills, and put the color in the backdrop, not the glass.
- **Raycast (raycast.com):** frosted command-palette panel where the fill is ~5% white but blur is high (20px+) with strong saturation, and the brand glow appears only behind the active element. Steal: hierarchy via frost density (heavier blur = more important surface), single-accent glow discipline.
- **Vercel/Geist dark surfaces:** opaque content cards + glass only on the sticky nav; focus states are 1px accent ring + soft outer glow, never thicker borders. Steal: their focus-ring recipe (used in `.glass-composer:focus-within` above) and glass-only-on-chrome restraint.

## Anti-patterns (cheap/AI-generated tells → fix)

- **Milky fog** (white alpha ≥ 0.15 on dark) → drop fill to 0.04–0.10, raise blur/saturate instead.
- **Blur without saturation** → gray mud; always `saturate(150–180%)`.
- **Uniform 1px white border on all four edges** → plastic look; use top-lit gradient border.
- **Glass over flat solid color** → nothing to refract, looks like low-opacity gray; ensure a subtle gradient/glow/noise exists behind every glass surface.
- **Glass on everything** (cards, bubbles, chips, modals all frosted) → hierarchy collapse + GPU cost; glass only on composer + floating chrome.
- **Colored glow as decoration on every element** → tint/glow only where it means something (active citation, primary action, focus).
- **Drop-shadow glow in light colors** (`box-shadow: 0 0 30px white`) → halos; shadows on dark themes go dark and down, light goes inset and up.
- **Animated "liquid" gradient sweeps** looping forever → gimmick; motion should respond to interaction only, and be removed under `prefers-reduced-motion`.

## Sources

- https://developer.apple.com/documentation/technologyoverviews/liquid-glass
- https://developer.apple.com/design/human-interface-guidelines/materials
- https://developer.apple.com/videos/play/wwdc2025/219/ (Meet Liquid Glass, WWDC25)
- https://github.com/conorluddy/LiquidGlassReference (distillation of Apple's HIG/API rules)
- https://www.createwithswift.com/liquid-glass-redefining-design-through-hierarchy-harmony-and-consistency/
- https://www.joshwcomeau.com/css/backdrop-filter/ (extended-backdrop mask trick, saturation)
- https://www.mitkov-systems.de/en/blog/css-liquid-glass-how-to
- https://csstopsites.com/glassmorphism-dark-backgrounds ; https://www.superdesign.dev/styles/glassmorphism
- https://blog.openreplay.com/creating-blurred-backgrounds-css-backdrop-filter/ (perf/Safari)
- https://developer.chrome.com/blog/css-prefers-reduced-transparency ; https://caniuse.com/mdn-css_at-rules_media_prefers-reduced-transparency

## Implementer caveats

Apple's own doc pages are JS-rendered so the HIG rules above were cross-verified via the WWDC session listing and two independent distillations of the HIG; the numeric CSS values are consensus ranges from multiple craft sources tuned for a warm dark base (white alphas lowered vs the light-theme defaults most generators emit — the most common mistake). The two non-negotiables from Apple: glass only on the floating control layer, and 4.5:1 text contrast after blur with system-style fallbacks for reduced transparency/motion.

---

# Part 3 — Chat UI patterns research (Perplexity citations, ChatGPT/Claude/Gemini layout, Figma Community)

# Crux Chat UI Patterns Brief (Pass 2: chat layout, citations, composer)

Scope note: glass material specs (blur/saturate/borders) were covered in pass 1 (liquid-glass-research-brief.md). This brief covers where glass goes in a chat, not what glass is.

## Chat layout rules

1. **Asymmetric message treatment: user gets a bubble, assistant gets none.** ChatGPT, Claude.ai, and Perplexity all render assistant answers as full-width text directly on the base surface; only the user's message gets a compact right-aligned container. Bubbles-everywhere signals "messenger app" and undermines the tool framing (Setproduct). For Crux: user message = small right-aligned glass pill/rounded-rect (this is where the glass material earns its keep, floating over the dark base); assistant answer = plain text on the page background, no card, no border.
2. **Cap the reading column at ~720-768px, line-height ~1.6.** Claude.ai and ChatGPT use ~768px, Perplexity ~720px; body text should land in the 65-75ch range. Wider columns make dense technical answers unscannable. Center the column; let the glass composer and chips share the same max-width so everything aligns to one vertical rail.
3. **Rhythm over dividers.** Separate turns with vertical whitespace (roughly 2x the intra-message spacing), never with rules or alternating background stripes. Stripes + glass = visual mud on dark.
4. **Timestamps and labels near-invisible or absent.** None of the top products show timestamps inline; identity is carried by alignment (user right, assistant left) plus at most a tiny avatar/logo mark on the assistant's first line. If Crux keeps timestamps, make them hover-only or 11px at ~40% opacity.
5. **Dense-answer typography inside the column:** headings only one step larger than body (not h1-scale), bold for key terms, tables inside their own `overflow-x-auto` container with a hairline border rather than heavy grid lines. On dark, use a slightly-lifted surface (not glass) behind code/tables so glass stays reserved for interactive chrome.
6. **Streaming: blinking caret at the end of streamed text, Stop button visible during generation, gone the instant it completes.** Pre-first-token state = a single shimmering line or pulsing dot, not a three-dot "typing" bubble (that's messenger language again).
7. **Empty state = centered composer + 3-4 suggestion chips.** Gemini's 2025 redesign and ChatGPT both do this: greeting, composer in the middle of the viewport, suggestion pills centered beneath it, then the composer docks to the bottom after the first message. For Crux the chips should be document-aware ("Summarize chapter 3", "Compare the two PDFs").

## Citation display patterns

What Perplexity does (the reference implementation, per AI UX Playground teardown):
- **Inline chips at the end of claims**, showing recognizable identity (favicon/domain name), with stacking ("northjersey +3") so one claim citing many sources stays one chip.
- **Click/hover opens a popover**: title + snippet + 1/N navigation to page through stacked sources without leaving the answer.
- **An answer-level source strip**: favicon stack + "10 sources" count beside copy/share actions, giving breadth at a glance.
- **A sources side panel** that opens while keeping the answer visible: cards with favicon, domain, title, snippet.

What Crux should steal (it already has file+page chips and an expandable passage panel, which maps 1:1):
1. Chips belong **at the end of the claim/paragraph they support**, not batched at the message bottom. Filename + page number is Crux's "favicon + domain".
2. **Stack chips per document**: "report.pdf p.4 +2" instead of three separate chips for one file. Popover pages through the passages 1/N, Perplexity-style.
3. Keep an **answer-level strip** ("3 sources · 2 documents") near the copy action, opening the existing passage panel; the panel should open beside/below without hiding the answer.
4. Chips are the one place inside the assistant's plain-text answer where glass appears: small glass pills that brighten on hover. This makes citations feel like Crux's signature object.
5. In the passage panel, **highlight the exact cited sentence** within the passage; that's the trust signal Perplexity gets from snippets.

## Composer patterns

1. **Shape: rounded-rect that reads as a pill at one line, grows to a capped multiline** (then scrolls internally). Pure pill breaks the moment a second line wraps. Docked to bottom, same 720px rail as the messages, floating on glass over the scrolling content.
2. **Focus: signaled by material change, not an outline ring.** Gemini removed the input outline entirely; on glass, brighten the top edge-lit border and lift fill opacity on focus (pass-1 material values). Keep an a11y-visible `:focus-visible` ring for keyboard users only.
3. **Attachments live as chips inside the composer, above the text row.** Attach button (paperclip/+) sits left inside the field; an attached PDF renders as a small pill with filename + remove-x inside the glass container, matching the citation chip vocabulary.
4. **Send affordance: circular filled button, right-inset, disabled/ghost until text exists, morphs into Stop (square-in-circle) while streaming.** This is ChatGPT/Claude/Gemini consensus. Enter sends, Shift+Enter newlines; keep focus in the composer after send.

## Figma Community findings

Honest caveat: Figma blocks server-side fetches (403), so details come from search descriptions, not full page inspection. Nothing found is a drop-in "liquid glass chat" worth copying wholesale; the closest hits:
1. [Messenger App – Liquid Glass UI Reinvention](https://www.figma.com/community/file/1557343620175532069/messenger-app-liquid-glass-ui-reinvention) — the only real liquid-glass + chat combination found: a Messenger redesign in iOS 26 aesthetics applying translucency/depth to bubbles and nav. Take: how it glasses the nav bar and composer while keeping the message list mostly opaque, i.e. glass on chrome, not on content. It's still a bubble-heavy messenger, so don't copy its message treatment.
2. [iOS 26 Liquid Glass FREE UI](https://www.figma.com/community/file/1515989174426612516/ios-26-liquid-glass-free-ui) — native-Figma-features liquid glass; take its list/toolbar surfaces as reference for the header and passage panel.
3. [glassy chatbot](https://www.figma.com/community/file/1231686199548408568/glassy-chatbot) — a small glassmorphism chatbot concept, pre-iOS-26; worth a 2-minute look in-browser but likely 2022-era heavy-blur styling.
Conclusion: the Perplexity/Claude layout patterns are the real design source; Figma files are only material references, which pass 1 already nailed.

## What NOT to add

- Assistant message bubbles, avatars on every turn, or alternating row backgrounds.
- Inline timestamps, read receipts, "typing…" three-dot bubbles, sound effects.
- Glass on the assistant's answer body or on tables/code blocks (glass-on-glass kills readability; reserve it for composer, user pill, chips, header, panel).
- Per-message toolbars always visible; show copy/feedback actions on hover only.
- Numbered superscript citations à la academic footnotes; Crux's named file+page chips are more recognizable than bare numbers.
- Suggestion chips after the first message; they're an empty-state device.

## Sources

- https://aiuxplayground.com/teardowns/perplexity/citations/ and https://www.aiuxplayground.com/gallery/perplexity-citations/
- https://www.setproduct.com/blog/ai-chat-interface-ui-design
- https://www.aydesign.ai/blog/ai-citation-source-ui-patterns-2026
- https://www.ubergizmo.com/2025/12/gemini-web-new-design/ and https://chromeunboxed.com/gemini-for-web-gets-a-sleek-redesign-with-a-new-dark-mode-and-a-my-stuff-hub/
- https://blog.openreplay.com/controlling-line-length-css-readability/
- Figma files: links in section above (details limited to public descriptions; direct fetch returns 403)

---

# Working note 2026-07-23 — demo-card → composer prefill (`crux:prefill` event)

Demo cards in `components/crux/demos.tsx` and the composer in `components/crux/tool.tsx` are sibling components with no shared parent state, so the "Try a demo like this →" link talks to the composer through a plain browser event instead of a context/provider:

- **Sender** (demos.tsx `loadDemo(q)`): `window.dispatchEvent(new CustomEvent('crux:prefill', { detail: q }))` then smooth-scrolls to `#tool`. `q` is always the card's own displayed question (`d.q`), so the prefill text can never drift from the card copy.
- **Listener** (tool.tsx, one `useEffect` near `editMessage`): reads `(e as CustomEvent<string>).detail`, ignores non-string/blank, and calls the existing `editMessage()` (same fill + focus + textarea auto-grow path the suggestion chips use).
- **Contract**: event name `crux:prefill`, `detail` = the question string. Fire-and-forget; if no doc is uploaded the text still fills and a send falls into general chat.

Also in this pass: the five demo filter tabs (All/Legal/Medical/Finance/HR) get `text-xs` + `px-2.5` + `gap-0.5` below `sm` so they hold one row at 390px (they previously wrapped "HR" to a second line); desktop sizes unchanged.
