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
