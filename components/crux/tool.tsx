'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remend from 'remend'
import 'katex/dist/katex.min.css'
import { ThinkingSkeleton } from './thinking-skeleton'

const MAX_MESSAGES = 15
const MAX_FILES = 10

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// Convert a recorded clip (webm/opus from MediaRecorder) into a WAV blob right
// here in the browser, so the mic feature can send the mp3/wav the ASR model
// expects without any server-side audio conversion. We decode to raw PCM via the
// Web Audio API, then wrap it in a standard 16-bit PCM WAV container.
async function webmToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer()
  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioCtx()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  const numCh = audioBuffer.numberOfChannels
  const rate = audioBuffer.sampleRate
  // interleave the channels into one stream of samples
  const samples = new Float32Array(audioBuffer.length * numCh)
  for (let ch = 0; ch < numCh; ch++) {
    const data = audioBuffer.getChannelData(ch)
    for (let i = 0; i < data.length; i++) samples[i * numCh + ch] = data[i]
  }
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2))
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numCh, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * numCh * 2, true)
  view.setUint16(32, numCh * 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  ctx.close()
  return new Blob([view], { type: 'audio/wav' })
}

// Typewriter reveal pacing (chars per animation frame, ~60fps). Eases in:
// starts slow, multiplies by DRIP_RAMP each frame up to DRIP_MAX_SPEED. Tuned
// to Claude.ai's reading-pace roll, not a network-speed dump — the ceiling is
// a comfortable reading speed, not "as fast as the buffer allows."
const DRIP_START_SPEED = 1.2 // ~72 chars/sec at the very start — deliberately slow
const DRIP_RAMP = 1.02 // gentle acceleration per frame
const DRIP_MAX_SPEED = 9 // ceiling, ~540 chars/sec — reading pace, not a burst

type Citation = { label: string; snippet?: string }

/** Backend citation label looks like "report.pdf · p. 14". Split into parts. */
function parseCitation(c: Citation): {
  file: string
  page: string
  snippet?: string
} {
  const clean = (c.label ?? '').replace(/^📄\s*/, '').trim()
  const [file, page] = clean.split(' · p. ')
  return {
    file: (file ?? clean).trim(),
    page: (page ?? '').trim(),
    snippet: c.snippet,
  }
}

type Source = { file: string; page: string; snippet?: string }

type Message = {
  id: number
  role: 'user' | 'crux'
  text: string
  /** every document passage the answer was drawn from (deduped, most-relevant first) */
  sources?: Source[]
  done?: boolean
  flash?: boolean
  ts?: number
  /** true when the answer came from the uploaded document; false = general knowledge */
  grounded?: boolean
  /** true when the user pressed stop before the answer finished */
  interrupted?: boolean
  /** the documents don't cover this — offer the user a Yes/No before answering from general knowledge */
  notCovered?: boolean
  /** the user's thumbs up/down on this answer, if they gave one */
  rating?: 'up' | 'down'
}

let idSeq = 1

/** Taglines rotate by day-of-month so they change daily without being random
 *  on every load. Document-work focused, Apple-level concise. */
const TAGLINES = [
  'The answer is already in there.',
  'Ask anything. Every answer comes with proof.',
  'Every claim, backed by the source.',
  'Nothing made up. Every word traceable.',
  'Stop searching. Start asking.',
  'Your documents are waiting.',
  'Your team already wrote the answer. Crux remembers where.',
]

/** Build a Claude-style greeting: day/time-aware headline + rotating tagline.
 *  Mirrors the full Claude.ai greeting set — day-of-week variants, Friday specials,
 *  weekend reads, late-night and early-morning catches. Name updates the headline
 *  live once the user submits the name form. */
function buildGreeting(
  name: string,
  nameDone: boolean,
): { headline: string; tagline: string } {
  const now = new Date()
  const h = now.getHours()
  const dow = now.getDay() // 0 Sun → 6 Sat
  const dom = now.getDate() // 1-31, seeds daily rotation
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const day = days[dow]
  const n = nameDone && name ? `, ${name}.` : '.'

  let headline: string
  if (h >= 22 || h < 5) {
    headline = nameDone && name ? `Night owl, ${name}.` : 'Still at it.'
  } else if (h < 8) {
    headline = nameDone && name ? `Up early, ${name}.` : 'Up early.'
  } else if (dow === 5) {
    // Friday: alternate variant by day-of-month parity
    const v = dom % 2 === 0 ? 'Happy Friday' : 'That Friday feeling'
    headline = nameDone && name ? `${v}, ${name}.` : `${v}.`
  } else if (dow === 6) {
    const v = dom % 2 === 0 ? 'Happy Saturday' : 'Weekend work'
    headline = nameDone && name ? `${v}, ${name}.` : `${v}.`
  } else if (dow === 0) {
    const v = dom % 2 === 0 ? 'Happy Sunday' : 'Sunday reading'
    headline = nameDone && name ? `${v}, ${name}.` : `${v}.`
  } else {
    headline = `Happy ${day}${n}`
  }

  return { headline, tagline: TAGLINES[dom % TAGLINES.length] }
}

// Real example questions the composer's placeholder types out when the box
// is sitting idle, so a first-time visitor sees what kind of question to ask.
const PLACEHOLDER_QUERIES = [
  'What was the water table depth at borehole BH-06?',
  'What does clause 4.2 say about liability?',
  'Summarise the notice period in this contract',
  'Which samples failed the minimum requirement?',
  'What standards does this report reference?',
]

/** Types the composer's placeholder through PLACEHOLDER_QUERIES, like a
 *  typewriter, whenever the box is empty and unfocused. Writes straight to
 *  the textarea's `placeholder` DOM attribute via a ref instead of React
 *  state, so the animation never triggers a re-render (and can't shift any
 *  layout) — only the invisible placeholder text changes each frame. Turns
 *  itself off (and never starts) under prefers-reduced-motion, showing the
 *  first query as a plain, static placeholder instead. */
function useTypewriterPlaceholder(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  active: boolean,
) {
  useEffect(() => {
    const el = ref.current
    if (!el || !active) return

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      el.placeholder = PLACEHOLDER_QUERIES[0]
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const typeIn = (text: string, i: number, done: () => void) => {
      if (cancelled) return
      el.placeholder = text.slice(0, i)
      if (i < text.length) timer = setTimeout(() => typeIn(text, i + 1, done), 25)
      else timer = setTimeout(done, 1400)
    }
    const typeOut = (text: string, i: number, done: () => void) => {
      if (cancelled) return
      el.placeholder = text.slice(0, i)
      if (i > 0) timer = setTimeout(() => typeOut(text, i - 1, done), 14)
      else done()
    }
    const cycle = (qi: number) => {
      if (cancelled) return
      const text = PLACEHOLDER_QUERIES[qi % PLACEHOLDER_QUERIES.length]
      typeIn(text, 0, () => typeOut(text, text.length, () => cycle(qi + 1)))
    }
    cycle(0)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [ref, active])
}

export function Tool() {
  const [files, setFiles] = useState<File[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  // large pasted text collapses into a removable chip (like Claude), kept out
  // of the visible textarea and prepended to the message on send
  const [pasted, setPasted] = useState<string | null>(null)
  // tracks focus so the typewriter placeholder only runs while the composer
  // is truly idle (empty AND unfocused), not while someone's about to type
  const [inputFocused, setInputFocused] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [orbFading, setOrbFading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [fileLimitWarn, setFileLimitWarn] = useState(false)
  // optional name, session-only — used naturally in replies, asked once on first load
  const [name, setName] = useState('')
  const [nameDone, setNameDone] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  // set after mount to avoid SSR/client hydration mismatch; re-runs when name is set
  const [greetingData, setGreetingData] = useState<{ headline: string; tagline: string }>({ headline: '', tagline: '' })

  // notification permission flow
  const [notifyPromptVisible, setNotifyPromptVisible] = useState(false)
  const notifyAskedRef = useRef(false)
  const notifyAllowedRef = useRef(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  // true while the user is parked at the bottom; if they scroll up to read we
  // stop auto-scrolling so the view doesn't fight them during streaming
  const atBottomRef = useRef(true)
  // distinguishes our own auto-scroll from a real user scroll, and tracks the
  // last position so any upward drag instantly stops the view from fighting back
  const programmaticScrollRef = useRef(false)
  const lastTopRef = useRef(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  // Claude/GPT-style "+" attach menu open/closed
  const [attachOpen, setAttachOpen] = useState(false)

  // "Knowledge gaps" panel — what the uploaded documents keep failing to answer.
  // Only meaningful once a document session exists; the backend itself decides
  // whether gap data exists at all (Teams/Postgres mode only).
  const [gapsOpen, setGapsOpen] = useState(false)
  const [gapsLoading, setGapsLoading] = useState(false)
  const [gapsSummary, setGapsSummary] = useState('')
  const [gapsCount, setGapsCount] = useState(0)
  const [gapsUnavailable, setGapsUnavailable] = useState(false)

  // Screen-reader announcement: only once per finished answer, never mid-stream
  // (announcing every drip-revealed token would spam a screen reader constantly).
  const [announceText, setAnnounceText] = useState('')
  const announcedIdRef = useRef<number | null>(null)
  // Voice input (mic): record -> transcribe -> drop the words into the box
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const genStartRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  // counts dragenter minus dragleave so crossing child elements doesn't flicker
  const dragDepth = useRef(0)

  // --- typewriter drip: reveal text at a steady pace, not in raw network bursts ---
  const dripTargetRef = useRef('') // full text received from the stream so far
  const dripShownRef = useRef(0) // how many chars are currently on screen
  const dripRafRef = useRef<number | null>(null)
  const dripDoneRef = useRef(false) // stream finished sending tokens
  const dripFinalRef = useRef<{ grounded: boolean; citations: Citation[]; notCovered: boolean } | null>(null)
  const dripSpeedRef = useRef(0) // chars/frame, ramps up so reveal eases in slow→fast

  useEffect(
    () => () => {
      if (dripRafRef.current != null) cancelAnimationFrame(dripRafRef.current)
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    },
    [],
  )

  // Announce a finished Crux answer to screen readers exactly once — watching
  // `done` (not the streaming text) keeps this from firing on every drip frame.
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last && last.role === 'crux' && last.done && announcedIdRef.current !== last.id) {
      announcedIdRef.current = last.id
      setAnnounceText(last.text)
    }
  }, [messages])

  // Escape closes whichever composer popover menu (or the gaps modal) is open.
  useEffect(() => {
    if (!attachOpen && !gapsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAttachOpen(false)
        setGapsOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [attachOpen, gapsOpen])

  // single source of truth: the rate-limit counter is just the user turns so far
  const messageCount = messages.filter((m) => m.role === 'user').length
  const remaining = MAX_MESSAGES - messageCount
  const hasDocs = files.length > 0
  const limitReached = remaining <= 0

  // composer is "idle" (eligible for the typewriter placeholder) only when
  // it's both empty and not focused
  const composerIdle = !input && !pasted && !inputFocused
  useTypewriterPlaceholder(inputRef, composerIdle)

  useEffect(() => {
    // only pin to the bottom if the user hasn't scrolled up; jump instantly
    // (not smooth) because this fires on every streamed frame
    if (!atBottomRef.current) return
    const el = scrollRef.current
    if (el) {
      // flag this as our scroll so handleScroll doesn't mistake it for the user
      programmaticScrollRef.current = true
      el.scrollTop = el.scrollHeight
      lastTopRef.current = el.scrollTop
    }
  }, [messages, isGenerating])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    // ignore the scroll event our own auto-scroll just produced
    if (programmaticScrollRef.current) {
      programmaticScrollRef.current = false
      lastTopRef.current = el.scrollTop
      return
    }
    // a real user scroll: any upward movement means "let me read" — stop
    // sticking immediately, even a tiny drag near the bottom. Re-stick only
    // when they come back to within a hair of the bottom.
    const movedUp = el.scrollTop < lastTopRef.current - 2
    lastTopRef.current = el.scrollTop
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (movedUp) atBottomRef.current = false
    else if (nearBottom) atBottomRef.current = true
  }

  useEffect(() => {
    setGreetingData(buildGreeting(name, nameDone))
  }, [name, nameDone])

  const fireNotification = useCallback((elapsed: number) => {
    if (elapsed < 5000) return
    if (typeof document !== 'undefined' && document.hasFocus()) return
    if (!notifyAllowedRef.current) return
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Crux', { body: 'Your answer is ready.' })
    }
  }, [])

  /** Build (or rebuild) this session's in-memory index from the current files. */
  const uploadSession = async (set: File[]) => {
    if (set.length === 0) {
      setSessionId(null)
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const form = new FormData()
      set.forEach((f) => form.append('files', f))
      const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSessionId(data.session_id)
    } catch {
      setUploadError('Could not read those documents. Try another file.')
      setSessionId(null)
    } finally {
      setUploading(false)
    }
  }

  /** Read the SSE token stream from POST /chat into the crux bubble. */
  const runQuery = async (
    question: string,
    history: { role: string; content: string }[],
    generalOnly = false,
  ) => {
    setIsGenerating(true)
    setOrbFading(false)
    genStartRef.current = performance.now()

    // reset the drip for this answer
    dripTargetRef.current = ''
    dripShownRef.current = 0
    dripDoneRef.current = false
    dripFinalRef.current = null
    dripSpeedRef.current = DRIP_START_SPEED
    if (dripRafRef.current != null) {
      cancelAnimationFrame(dripRafRef.current)
      dripRafRef.current = null
    }

    let msgId = -1
    const ensureBubble = () => {
      if (msgId === -1) {
        msgId = idSeq++
        setOrbFading(true)
        setIsGenerating(false)
        setMessages((prev) => [
          ...prev,
          { id: msgId, role: 'crux', text: '', ts: Date.now() },
        ])
      }
    }

    // advance the visible text toward what's been received, one whole word at
    // a time — never mid-word, which is what makes each word feel like it
    // softly resolves instead of a teletype spraying letters. The reveal
    // speed eases in (starts slow, accelerates each frame, like Claude). A
    // modest catch-up (at most 2x the current pace) engages when a lot of
    // text is buffered, so a big network burst never lags far behind — but it
    // never dumps a percentage of the backlog in one frame like before.
    const dripTick = () => {
      const target = dripTargetRef.current
      const shown = dripShownRef.current
      if (shown < target.length) {
        dripSpeedRef.current = Math.min(DRIP_MAX_SPEED, dripSpeedRef.current * DRIP_RAMP)
        const rampedSpeed = dripSpeedRef.current
        const remaining = target.length - shown
        const budget = Math.round(
          remaining > rampedSpeed * 3 ? rampedSpeed * 2 : rampedSpeed,
        )
        // walk forward token by token (a token is one word or one run of
        // whitespace) until we've spent at least `budget` chars, snapping to
        // the token boundary rather than a raw char count.
        const remainder = target.slice(shown)
        const tokens = remainder.match(/\S+|\s+/g) ?? []
        let spent = 0
        let next = shown
        for (let i = 0; i < tokens.length; i++) {
          const tok = tokens[i]
          const isLastToken = i === tokens.length - 1
          // the last token in the buffer might be a word the network hasn't
          // finished sending yet — hold it back until more arrives, unless
          // the stream is done and nothing more is ever coming
          if (isLastToken && !dripDoneRef.current && /\S/.test(tok)) break
          next += tok.length
          spent += tok.length
          if (spent >= budget) break
        }
        dripShownRef.current = next
        const text = target.slice(0, next)
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, text } : m)))
        dripRafRef.current = requestAnimationFrame(dripTick)
        return
      }
      // caught up to everything received
      if (dripDoneRef.current) {
        const final = dripFinalRef.current
        const grounded = final?.grounded === true
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  text: target,
                  done: true,
                  flash: true,
                  grounded,
                  sources: grounded ? (final?.citations ?? []).map(parseCitation) : undefined,
                  notCovered: final?.notCovered === true,
                }
              : m,
          ),
        )
        dripRafRef.current = null
      } else {
        // nothing more to show yet — stop; a new token will restart the loop
        dripRafRef.current = null
      }
    }
    const ensureDrip = () => {
      if (dripRafRef.current == null) dripRafRef.current = requestAnimationFrame(dripTick)
    }

    const controller = new AbortController()
    abortRef.current = controller

    // The free HF Space sleeps after ~15 min idle and takes 30-60s to wake, so
    // the first request after a nap fails to connect. Retry once after a short
    // wait and tell the user we're waking the server rather than erroring out.
    const postChat = () =>
      fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: question, history, name: name || undefined, general_only: generalOnly }),
        signal: controller.signal,
      })

    try {
      let res: Response
      try {
        res = await postChat()
      } catch (connErr) {
        if ((connErr as Error)?.name === 'AbortError') throw connErr
        ensureBubble()
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, text: 'Waking the server… this can take up to a minute on the first request.' } : m,
          ),
        )
        await new Promise((r) => setTimeout(r, 4000))
        res = await postChat()
        // clear the waking notice so the real answer starts fresh
        dripTargetRef.current = ''
        dripShownRef.current = 0
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, text: '' } : m)))
      }
      if (!res.ok || !res.body) throw new Error('chat failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''
        for (const frame of frames) {
          const line = frame.replace(/^data:\s*/, '').trim()
          if (!line) continue
          let data: {
            token?: string
            done?: boolean
            grounded?: boolean
            citations?: Citation[]
            not_covered?: boolean
          }
          try {
            data = JSON.parse(line)
          } catch {
            continue
          }
          if (typeof data.token === 'string') {
            ensureBubble()
            dripTargetRef.current += data.token
            ensureDrip()
          } else if (data.done) {
            ensureBubble()
            dripFinalRef.current = {
              grounded: data.grounded === true,
              citations: Array.isArray(data.citations) ? data.citations : [],
              notCovered: data.not_covered === true,
            }
            dripDoneRef.current = true
            ensureDrip() // flush whatever's left, then finalize
          }
        }
      }
    } catch (err) {
      // user pressed stop — keep whatever streamed so far, mark it interrupted
      if ((err as Error)?.name === 'AbortError') {
        if (dripRafRef.current != null) {
          cancelAnimationFrame(dripRafRef.current)
          dripRafRef.current = null
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, done: true, interrupted: true } : m)),
        )
      } else {
        ensureBubble()
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, done: true, text: "Couldn't reach the server. Is the API running?" }
              : m,
          ),
        )
      }
    } finally {
      abortRef.current = null
      setIsGenerating(false)
      fireNotification(performance.now() - genStartRef.current)
    }
  }

  /** Stop an in-flight answer — like Claude's stop button. */
  const stopGenerating = () => {
    abortRef.current?.abort()
    setIsGenerating(false)
  }

  const send = (rawText: string) => {
    const typed = rawText.trim()
    // pasted block (if any) leads the message; typed text follows
    const text = pasted ? `${pasted}\n\n${typed}`.trim() : typed
    if (!text || isGenerating || limitReached) return
    setPasted(null)

    // ask for notification permission once, on first message (never on upload)
    if (!notifyAskedRef.current) {
      notifyAskedRef.current = true
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'default'
      ) {
        setNotifyPromptVisible(true)
      }
    }

    // backend memory format: user/assistant turns from finished messages
    const history = messages
      .filter((m) => m.done && m.text)
      .map((m) => ({
        role: m.role === 'crux' ? 'assistant' : 'user',
        content: m.text,
      }))

    // sending always jumps to the newest message
    atBottomRef.current = true
    // compute the id before the updater — React can invoke a state updater
    // more than once (e.g. under StrictMode), so incrementing idSeq inside
    // it could burn extra ids or double-count; capturing it first keeps the
    // updater itself pure.
    const newId = idSeq++
    setMessages((prev) => [
      ...prev,
      { id: newId, role: 'user', text, done: true, ts: Date.now() },
    ])
    setInput('')

    // No upload required — with no session the backend answers from general
    // knowledge, so Crux works as a chatbot before any document is added.
    runQuery(text, history)
  }

  // User said "yes" to a not-covered prompt — re-ask the same question with
  // general_only so the backend skips retrieval and answers directly.
  const answerGeneral = (msgId: number, question: string) => {
    if (isGenerating || limitReached || !question) return
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, notCovered: false } : m)))
    atBottomRef.current = true
    const history = messages
      .filter((m) => m.done && m.text)
      .map((m) => ({ role: m.role === 'crux' ? 'assistant' : 'user', content: m.text }))
    runQuery(question, history, true)
  }

  // User said "no" — just dismiss the prompt, no request needed.
  const declineGeneral = (msgId: number) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, notCovered: false } : m)))
  }

  // Regenerate — only ever offered on the last assistant answer. Drops that
  // one answer and re-asks the same question in its place; the user's
  // question bubble above it is untouched, so this never creates a
  // duplicate user message.
  const regenerate = (msgId: number, question: string) => {
    if (isGenerating || limitReached || !question) return
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msgId)
      return idx === -1 ? prev : prev.slice(0, idx)
    })
    atBottomRef.current = true
    const history = messages
      .filter((m) => m.done && m.text && m.id !== msgId)
      .map((m) => ({ role: m.role === 'crux' ? 'assistant' : 'user', content: m.text }))
    runQuery(question, history)
  }

  // Thumbs up/down on an answer. Optimistic — the UI locks in the choice
  // immediately; if the POST fails we just log it, never block reading. Ratings
  // are switchable, so this can fire twice for one down-vote: once immediately
  // (rating only) and once more from the "what went wrong" popover on Submit
  // (adds category/comment) — the backend just appends each as its own log line.
  const sendFeedback = (
    msgId: number,
    question: string,
    answer: string,
    rating: 'up' | 'down',
    citations: Source[] | undefined,
    detail?: { category?: string; comment?: string },
  ) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, rating } : m)))
    fetch(`${API_BASE}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        question,
        answer,
        rating,
        category: detail?.category ?? null,
        comment: detail?.comment ?? null,
        citations: citations ?? [],
      }),
    }).catch((err) => console.error('feedback failed', err))
  }

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return
    const byName = new Map(files.map((f) => [f.name, f]))
    incoming.forEach((f) => byName.set(f.name, f))
    if (byName.size > MAX_FILES) {
      setFileLimitWarn(true)
      setTimeout(() => setFileLimitWarn(false), 3500)
    }
    const merged = Array.from(byName.values()).slice(0, MAX_FILES)
    setFiles(merged)
    uploadSession(merged)
  }

  const removeFile = (name: string) => {
    const next = files.filter((f) => f.name !== name)
    setFiles(next)
    uploadSession(next)
  }

  // ---- Voice input --------------------------------------------------------
  // Record from the mic, convert to WAV in the browser (MediaRecorder gives
  // webm, but the ASR model wants mp3/wav), send it to /transcribe, and drop the
  // spoken words into the message box so a client can talk instead of type.
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      audioChunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size) audioChunksRef.current.push(e.data)
      }
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setTranscribing(true)
        try {
          const wav = await webmToWav(new Blob(audioChunksRef.current, { type: 'audio/webm' }))
          const form = new FormData()
          form.append('file', wav, 'recording.wav')
          const res = await fetch(`${API_BASE}/transcribe`, { method: 'POST', body: form })
          const data = await res.json()
          if (data.text) {
            setInput((prev) => (prev ? `${prev} ${data.text}` : data.text))
            inputRef.current?.focus()
          }
        } catch (e) {
          console.warn('transcription failed', e)
        } finally {
          setTranscribing(false)
        }
      }
      rec.start()
      mediaRecorderRef.current = rec
      setIsRecording(true)
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000)
    } catch (e) {
      console.warn('mic access denied', e)
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  const toggleRecording = () => (isRecording ? stopRecording() : startRecording())

  const handleNotifyChoice = (allow: boolean) => {
    setNotifyPromptVisible(false)
    if (allow && typeof Notification !== 'undefined') {
      Notification.requestPermission().then((perm) => {
        notifyAllowedRef.current = perm === 'granted'
      })
    }
  }

  const clearSession = () => {
    if (sessionId) {
      fetch(`${API_BASE}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: '', history: [] }),
      }).catch((e) => console.warn('clear session failed', e))
    }
    setFiles([])
    setMessages([])
    setSessionId(null)
    setUploadError(null)
  }

  const openGaps = async () => {
    setGapsOpen(true)
    setGapsLoading(true)
    setGapsUnavailable(false)
    try {
      const res = await fetch(`${API_BASE}/gaps/summary?session_id=${sessionId}`)
      const data = await res.json()
      if (data.note) {
        // Private mode (no database) — the backend says so explicitly rather
        // than returning an empty summary that would look like "no gaps found".
        setGapsUnavailable(true)
      } else {
        setGapsSummary(data.summary || '')
        setGapsCount(data.count || 0)
      }
    } catch (e) {
      console.warn('gaps summary failed', e)
      setGapsUnavailable(true)
    } finally {
      setGapsLoading(false)
    }
  }

  // refill the composer with a previous question to edit and resend (like Claude)
  const editMessage = useCallback((text: string) => {
    setInput(text)
    const el = inputRef.current
    if (el) {
      el.focus()
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`
    }
  }, [])

  const counterColor =
    remaining <= 0
      ? 'text-warn'
      : remaining <= 3
        ? 'text-warn/80'
        : 'text-muted-foreground'

  const showHeader = hasDocs || messages.length > 0

  return (
    <section id="tool" className="relative px-6 py-20 md:py-28">
      <div className="mx-auto max-w-3xl lg:max-w-4xl">
        {/* Chat panel — always present, whole panel is a drop target */}
        <div
          onDragEnter={(e) => {
            // only react to files, never to text/element selection drags
            if (!e.dataTransfer.types.includes('Files')) return
            e.preventDefault()
            dragDepth.current += 1
            setDragOver(true)
          }}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes('Files')) return
            e.preventDefault()
          }}
          onDragLeave={(e) => {
            if (!e.dataTransfer.types.includes('Files')) return
            dragDepth.current -= 1
            if (dragDepth.current <= 0) {
              dragDepth.current = 0
              setDragOver(false)
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            dragDepth.current = 0
            setDragOver(false)
            if (e.dataTransfer.files.length) addFiles(Array.from(e.dataTransfer.files))
          }}
          className={`overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors ${
            dragOver ? 'border-accent bg-accent/5' : 'border-border'
          }`}
        >
          {/* Header — file context + visible clear */}
          {showHeader && (
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="truncate text-sm text-muted-foreground">
                {hasDocs ? (
                  <>
                    Asking{' '}
                    <span className="font-medium text-foreground">
                      {files.length === 1
                        ? files[0].name
                        : `${files.length} documents`}
                    </span>
                  </>
                ) : (
                  'New conversation'
                )}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {hasDocs && sessionId && (
                  <button
                    type="button"
                    onClick={openGaps}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-accent/50 hover:text-accent"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
                    </svg>
                    Knowledge gaps
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearSession}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-warn/50 hover:text-warn"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path
                      d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Clear session
                </button>
              </div>
            </div>
          )}

          {/* Knowledge-gaps panel: what the uploaded documents keep failing to
              answer. Surfaces a backend feature (/gaps/summary) that already
              existed with no UI — this is its first visible entry point. */}
          {gapsOpen && (
            <>
              <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={() => setGapsOpen(false)} />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Knowledge gaps"
                  className="fade-in max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-heading text-lg font-semibold text-foreground">Knowledge gaps</h2>
                    <button
                      type="button"
                      onClick={() => setGapsOpen(false)}
                      aria-label="Close"
                      className="rounded p-1 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>

                  {gapsLoading ? (
                    <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
                      <span className="thinking-orb !h-4 !w-4" />
                      Looking through what your documents couldn&apos;t answer…
                    </div>
                  ) : gapsUnavailable ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Knowledge gaps need persistent storage (Teams mode) to track questions across a
                      session. This deployment is running in Private mode, so nothing is stored to
                      analyse — by design.
                    </p>
                  ) : gapsCount === 0 ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      No gaps yet — every question so far was answered from the documents.
                    </p>
                  ) : (
                    <>
                      <p className="mb-3 text-xs text-muted-foreground">
                        Based on {gapsCount} question{gapsCount === 1 ? '' : 's'} your documents couldn&apos;t answer:
                      </p>
                      <div className="text-sm leading-relaxed text-card-foreground">
                        <CruxMarkdown text={gapsSummary} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Announces a finished answer once, without spamming every streamed token */}
          <div aria-live="polite" className="sr-only">
            {announceText}
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="max-h-[600px] min-h-[320px] space-y-4 overflow-y-auto p-5"
          >
            {messages.length === 0 && !isGenerating && (
              <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2.5 text-center">
                {/* Product first, name-ask second: nothing here blocks a first-time
                    visitor from immediately seeing what Crux does. */}
                {greetingData.headline && (
                  <p className="max-w-sm font-heading text-2xl font-semibold leading-tight tracking-tight text-foreground md:text-[28px]">
                    {greetingData.headline}
                  </p>
                )}

                {greetingData.tagline && (
                  <p className="text-sm font-medium text-muted-foreground">
                    {greetingData.tagline}
                  </p>
                )}

                {!hasDocs && (
                  <>
                    <svg className="h-7 w-7 text-muted-foreground/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="text-sm text-muted-foreground">
                      Drop a document here, or just start typing.
                    </p>
                    <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground/80">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <rect x="5" y="11" width="14" height="9" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Read in memory · never stored
                    </p>
                  </>
                )}

                {/* small, optional, non-blocking — never had to be answered to use Crux.
                    Kept visually quiet (smaller, softer border) so it reads as a minor
                    aside, not a competitor to the "drop a document" line above it. */}
                {!nameDone && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      setName(nameDraft.trim())
                      setNameDone(true)
                    }}
                    className="mt-2"
                  >
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder="What should I call you? (optional)"
                      className="w-48 rounded-full border border-border/50 bg-transparent px-3 py-1 text-center text-[11px] text-muted-foreground placeholder:text-muted-foreground/60 focus:border-accent focus:text-foreground focus:outline-none"
                    />
                  </form>
                )}
              </div>
            )}

            {messages.map((m, i) => (
              <MessageBubble
                key={m.id}
                message={m}
                onEdit={editMessage}
                onAnswerGeneral={() => answerGeneral(m.id, messages[i - 1]?.text ?? '')}
                onDeclineGeneral={() => declineGeneral(m.id)}
                onFeedback={(rating, detail) =>
                  sendFeedback(m.id, messages[i - 1]?.text ?? '', m.text, rating, m.sources, detail)
                }
                // regenerate only ever offered on the LAST assistant message
                onRegenerate={
                  m.role === 'crux' && m.done && i === messages.length - 1
                    ? () => regenerate(m.id, messages[i - 1]?.text ?? '')
                    : undefined
                }
              />
            ))}

            {isGenerating && (
              <div className="message-in">
                <ThinkingSkeleton fading={orbFading} />
              </div>
            )}

            {/* limit reached card */}
            {limitReached && (
              <div className="fade-in rounded-xl border border-warn/40 bg-surface p-4 text-center">
                <p className="text-sm text-foreground">
                  You&apos;ve used your 15 free messages.
                </p>
                <a
                  href="#contact"
                  className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground transition hover:scale-[1.02]"
                >
                  Book a 15-minute call →
                </a>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-border p-4">
            {/* Notify bar — sits directly above the composer (Claude-style), same
                width as it. The wrapper is always mounted and animates height via a
                grid-rows transition so the composer below never jumps. */}
            <div
              className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out ${
                notifyPromptVisible ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="min-h-0">
                <div className="mb-2.5 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3.5 py-2">
                  <span className="text-xs text-foreground">
                    Want to be notified when your answer is ready?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleNotifyChoice(true)}
                      className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground transition hover:bg-accent/90"
                    >
                      Notify me
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifyPromptVisible(false)}
                      aria-label="Dismiss"
                      className="rounded p-1 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Composer wrapper. Was "liquid glass" (blur/inset-shine/coloured
                glow) — dropped because those effects were nearly invisible on
                the light paper background and just added complexity. Now a
                plain solid card that still shows a clear focus state. */}
            <div className="relative">
              <div className="relative rounded-2xl border border-border bg-card px-3 pb-2.5 pt-3 transition focus-within:border-accent">
              {/* file chips — compact, Claude-style */}
              {hasDocs && (
                <div className="mb-2.5 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                  {files.map((f) => (
                    <span
                      key={f.name}
                      className="inline-flex max-w-[160px] items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-[11px]"
                    >
                      <svg className="h-3 w-3 shrink-0 text-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="truncate font-medium text-foreground">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(f.name)}
                        aria-label={`Remove ${f.name}`}
                        className="shrink-0 text-muted-foreground transition hover:text-warn"
                      >
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* upload status — one animated slot so these don't pop the textarea around */}
              <div
                className={`grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out ${
                  uploading || fileLimitWarn || uploadError ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="min-h-0">
                  {uploading && (
                    <p className="mb-2 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                      <span className="thinking-orb !h-3 !w-3" />
                      Reading your document…
                    </p>
                  )}
                  {fileLimitWarn && (
                    <p className="mb-2 font-mono text-[11px] text-warn">
                      Only {MAX_FILES} documents per session — extra files were skipped.
                    </p>
                  )}
                  {uploadError && (
                    <p className="mb-2 font-mono text-[11px] text-warn">{uploadError}</p>
                  )}
                </div>
              </div>

              {/* pasted-text chip — collapsed, hover to remove (like Claude) */}
              {pasted && (
                <div className="group/paste fade-in mb-2.5 inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
                  <svg className="h-3.5 w-3.5 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="9" y="3" width="6" height="4" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[11px] font-medium text-foreground">Pasted text</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {pasted.split('\n').length} lines · {pasted.length} chars
                  </span>
                  <button
                    type="button"
                    onClick={() => setPasted(null)}
                    aria-label="Remove pasted text"
                    title="Remove"
                    className="ml-1 shrink-0 text-muted-foreground transition hover:text-warn"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              )}

              {/* composer — message field on top, controls below (Claude-style) */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  send(input)
                }}
                className="flex flex-col gap-2"
              >
                {/* hidden pickers: one for files & photos, one for audio */}
                <input
                  ref={addInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.xlsx,.csv,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files ?? []))
                    e.target.value = ''
                  }}
                />
                <input
                  ref={audioInputRef}
                  type="file"
                  multiple
                  accept=".mp3,.wav"
                  className="hidden"
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files ?? []))
                    e.target.value = ''
                  }}
                />

                {/* the message field, full width on top */}
                <textarea
                  ref={inputRef}
                  value={input}
                  aria-label="Ask a question about your document"
                  rows={1}
                  onChange={(e) => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
                  }}
                  onKeyDown={(e) => {
                    // Enter sends, Shift+Enter makes a new line (like Claude/GPT)
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send(input)
                      if (inputRef.current) inputRef.current.style.height = 'auto'
                    }
                  }}
                  onPaste={(e) => {
                    const clip = e.clipboardData.getData('text')
                    if (clip.length > 1200) {
                      e.preventDefault()
                      setPasted((prev) => (prev ? `${prev}\n\n${clip}` : clip))
                    }
                  }}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  disabled={limitReached}
                  placeholder={
                    isRecording
                      ? 'Listening…'
                      : composerIdle
                        // left empty on purpose — useTypewriterPlaceholder owns
                        // this text while the box is idle, written straight to
                        // the DOM so the animation never re-renders this component
                        ? ''
                        : hasDocs
                          ? 'Ask anything about your document…'
                          : 'Write a message…'
                  }
                  className="max-h-40 w-full resize-none bg-transparent px-1 pt-0.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
                />

                {/* controls row: [+] on the left, mic · send on the right */}
                <div className="flex items-center justify-between gap-2">
                  {/* "+" attach button with a Claude-style pop-up menu */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setAttachOpen((o) => !o)}
                      disabled={files.length >= MAX_FILES}
                      aria-label="Add attachment"
                      aria-expanded={attachOpen}
                      title="Add files, photos or audio"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-accent disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                      </svg>
                    </button>

                    {attachOpen && (
                      <>
                        {/* click-away layer */}
                        <div className="fixed inset-0 z-10" onClick={() => setAttachOpen(false)} />
                        {/* menu opens upward, since the bar sits at the bottom */}
                        <div className="fade-in absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-xl">
                          <button
                            type="button"
                            onClick={() => {
                              setAttachOpen(false)
                              addInputRef.current?.click()
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-muted"
                          >
                            <svg className="h-[18px] w-[18px] text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                              <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Add files or photos
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAttachOpen(false)
                              audioInputRef.current?.click()
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-muted"
                          >
                            <svg className="h-[18px] w-[18px] text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                              <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
                              <circle cx="6" cy="18" r="3" />
                              <circle cx="18" cy="16" r="3" />
                            </svg>
                            Add audio file
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* mic · send */}
                  <div className="flex items-center gap-2">
                    {/* mic — record voice, transcribe into the box */}
                    {isRecording && (
                      <span className="text-[11px] font-medium tabular-nums text-warn">
                        {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={toggleRecording}
                      disabled={limitReached || transcribing}
                      aria-label={isRecording ? 'Stop recording' : 'Record voice'}
                      title={isRecording ? 'Stop recording' : transcribing ? 'Transcribing…' : 'Record voice'}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                        isRecording
                          ? 'animate-pulse bg-warn/10 text-warn'
                          : 'text-muted-foreground hover:bg-muted hover:text-accent'
                      }`}
                    >
                      {transcribing ? (
                        <span className="thinking-orb !h-3.5 !w-3.5" />
                      ) : (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                          <rect x="9" y="2" width="6" height="12" rx="3" />
                          <path d="M5 10a7 7 0 0 0 14 0M12 17v4" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>

                    {/* send / stop */}
                    {isGenerating ? (
                      <button
                        type="button"
                        onClick={stopGenerating}
                        aria-label="Stop"
                        title="Stop generating"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="7" y="7" width="10" height="10" rx="1.5" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={limitReached || (!input.trim() && !pasted)}
                        aria-label="Send"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition enabled:hover:scale-105 enabled:hover:brightness-110 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
            </div>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Crux can make mistakes. Double-check the source.
              {messageCount > 0 && (
                <span className={counterColor}>
                  {' '}
                  · {remaining} message{remaining === 1 ? '' : 's'} remaining
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function formatTime(ts?: number) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Defined once at module scope, NOT inside the component: passing a fresh
// components/plugins object on every render makes react-markdown re-parse the
// whole answer each streamed token (O(n²)), which dropped keystrokes.
const REMARK_PLUGINS = [remarkGfm, remarkMath]
const REHYPE_PLUGINS = [rehypeKatex]
const MD_COMPONENTS: Components = {
  p: (props) => <p className="mb-2 last:mb-0" {...props} />,
  ul: (props) => <ul className="mb-2 list-disc space-y-0.5 pl-5" {...props} />,
  ol: (props) => <ol className="mb-2 list-decimal space-y-0.5 pl-5" {...props} />,
  strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
  a: (props) => <a className="text-accent underline" {...props} target="_blank" rel="noopener noreferrer" />,
  pre: (props) => (
    <pre className="my-3 overflow-x-auto rounded-xl bg-[#2A2320] p-4 text-[12px] font-mono leading-relaxed text-[#E8DFD6]" {...props} />
  ),
  code: ({ className, children, ...props }) => {
    // block code: has a language-xxx class (fenced) or is multiline (unfenced)
    const isBlock = !!className || String(children).includes('\n')
    if (isBlock) {
      return <code className={`${className ?? ''} font-mono`} {...props}>{children}</code>
    }
    return <code className="rounded bg-border/60 px-1 py-0.5 font-mono text-[12px]" {...props}>{children}</code>
  },
  h1: (props) => <h3 className="mb-1 mt-2 font-semibold" {...props} />,
  h2: (props) => <h3 className="mb-1 mt-2 font-semibold" {...props} />,
  h3: (props) => <h3 className="mb-1 mt-2 font-semibold" {...props} />,
  table: (props) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs" {...props} />
    </div>
  ),
  th: (props) => <th className="border border-border bg-surface px-2 py-1 text-left font-semibold" {...props} />,
  td: (props) => <td className="border border-border px-2 py-1 align-top" {...props} />,
  blockquote: (props) => <blockquote className="border-l-2 border-border pl-3 italic text-muted-foreground" {...props} />,
}

/** Strip raw HTML <br> tags the model emits despite the system prompt,
 *  and clip a half-written table row so the parser doesn't render garbage mid-stream. */
// a backslash-command (\frac, \text…) or a sub/superscript group — i.e. raw TeX
const TEX_CMD = /\\[a-zA-Z]+|[_^]\{/

/** Repair an odd number of `$$` delimiters. The model occasionally drops an
 *  opening `$$`, leaving a formula as raw text with a stray trailing `$$`. With
 *  one orphan delimiter, wrap the preceding raw-TeX run; if that text isn't TeX,
 *  drop the stray `$$` instead so it doesn't render literally. */
function repairDisplayMath(s: string): string {
  const segs = s.split('$$')
  if (segs.length % 2 === 1) return s // even count of $$ → already balanced
  const i = segs.length - 2
  if (TEX_CMD.test(segs[i])) {
    const m = segs[i].match(/^(\s*)([\s\S]*)$/)!
    segs[i] = m[1] + '$$' + m[2] // insert the missing opening delimiter
  } else {
    segs[i] = segs[i] + segs[i + 1] // not math — merge across the stray $$
    segs.splice(i + 1, 1)
  }
  return segs.join('$$')
}

/** Content between two `$` signs is math — not currency — when it contains
 *  TeX commands/scripts (`\`, `^`, `_`) or is a plain decimal/integer ("0.9"). */
function looksLikeMath(between: string): boolean {
  // TeX control chars, scripts, or brace-grouping (e.g. the "{,}" thousands
  // trick) — currency amounts never contain these.
  if (/[\\^_{}]/.test(between)) return true
  if (/^\s*\d+(\.\d+)?\s*$/.test(between)) return true
  return false
}

/** Escape currency `$` signs so remark-math doesn't pair them as math delimiters.
 *  Only escapes `$NUMBER` when there is no nearby closing `$` whose enclosed
 *  content looks like actual math. This prevents `$70k–$95k` from being swallowed
 *  as a math expression while leaving `$57\%$` and `$0.9$` untouched. */
function escapeCurrency(s: string): string {
  return s.replace(/(?<![$\\])\$(?=\d)/g, (_: string, offset: number) => {
    const rest = s.slice(offset + 1)
    // Find the next unescaped single $ (skip $$ display delimiters)
    const closeIdx = rest.search(/(?<!\\)\$(?!\$)/)
    if (closeIdx < 0 || closeIdx > 80) return '\\$' // no closing $ nearby → currency
    const between = rest.slice(0, closeIdx)
    return looksLikeMath(between) ? '$' : '\\$'
  })
}

/** Ensure \begin{aligned} (and similar environments) are always wrapped in $$.
 *  The model sometimes drops the opening $$, leaving raw TeX. We strip any
 *  partial wrapping and re-add both delimiters cleanly. */
function normalizeDisplayEnv(s: string): string {
  return s
    .replace(/\$?\$?\s*\\begin\{(aligned|align\*?|gather\*?|cases|[pPbBvV]?matrix)\}/g,
      '\n$$\n\\begin{$1}')
    .replace(/\\end\{(aligned|align\*?|gather\*?|cases|[pPbBvV]?matrix)\}\s*\$?\$?/g,
      '\\end{$1}\n$$\n')
}

function sanitizeMd(text: string): string {
  let out = text.replace(/<br\s*\/?>/gi, '  \n')
  // The model emits LaTeX with \( \) and \[ \] delimiters, but remark-math only
  // recognises $ … $ and $$ … $$. Normalise so equations actually render.
  out = out
    .replace(/\\\[|\\\]/g, () => '$$')
    .replace(/\\\(|\\\)/g, () => '$')
  out = normalizeDisplayEnv(out)
  out = escapeCurrency(out)
  out = repairDisplayMath(out)
  const lines = out.split('\n')
  const last = lines[lines.length - 1]
  // an incomplete table row starts with | but doesn't end with one yet
  if (last.trimStart().startsWith('|') && !last.trimEnd().endsWith('|')) {
    lines[lines.length - 1] = ''
  }
  return lines.join('\n')
}

/** Split off the paragraph currently being typed (after the last blank
 *  line) from everything already settled above it. Only the active
 *  paragraph needs word-fade handling — once a blank line closes it, it
 *  moves into the fully-parsed markdown history below, where bold/tables/
 *  code render correctly again. */
function splitLastParagraph(text: string): { prior: string; current: string } {
  const idx = text.lastIndexOf('\n\n')
  if (idx === -1) return { prior: '', current: text }
  return { prior: text.slice(0, idx), current: text.slice(idx + 2) }
}

/** Split the active paragraph into its markdown-safe settled prefix and the
 *  newest word, so only the newest word gets the reveal-fade span. */
function splitTrailingWord(text: string): { settled: string; trailing: string } {
  const m = text.match(/\S+\s*$/)
  const trailing = m ? m[0] : ''
  const settled = trailing ? text.slice(0, text.length - trailing.length) : text
  return { settled, trailing }
}

function CruxMarkdown({ text, streaming }: { text: string; streaming?: boolean }) {
  if (!streaming) {
    return (
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={MD_COMPONENTS}
      >
        {sanitizeMd(text)}
      </ReactMarkdown>
    )
  }
  // While streaming, everything up to the last completed paragraph renders
  // as normal markdown (safe — it's finished text). The paragraph still being
  // typed is ALSO run through remend + ReactMarkdown now, not left as raw
  // text — that raw-text path was the actual bug: it's what's on screen for
  // most of the stream, so any **bold, a heading, or a table row being typed
  // showed its literal markdown characters the whole time. remend closes
  // whatever marker hasn't streamed its match yet (e.g. a dangling **) so the
  // parser renders it instead of choking on it. Only the newest word still
  // gets the fade-reveal span, spliced into the last real <p> so it stays
  // inline instead of dropping onto its own line.
  const { prior, current } = splitLastParagraph(text)
  const { settled, trailing } = splitTrailingWord(current)
  // How many <p> elements ReactMarkdown will actually render for `settled` —
  // used below to find the LAST one so the fade span lands in the right spot
  // (if settled's last block is a heading/table/code fence instead, the word
  // is simply not spliced in for this one frame; it renders correctly a beat
  // later once more text confirms which block it belongs to).
  const settledParagraphCount = settled.split(/\n{2,}/).filter((p) => p.trim()).length
  let pIndex = 0
  const currentComponents: Components = {
    ...MD_COMPONENTS,
    p: ({ children, ...props }) => {
      pIndex += 1
      const isLast = pIndex === settledParagraphCount
      return (
        <p className="mb-2 last:mb-0" {...props}>
          {children}
          {isLast && trailing && (
            <span key={text.length} className="word-reveal">
              {trailing}
            </span>
          )}
        </p>
      )
    },
  }
  return (
    <>
      {prior && (
        <ReactMarkdown
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={REHYPE_PLUGINS}
          components={MD_COMPONENTS}
        >
          {remend(sanitizeMd(prior))}
        </ReactMarkdown>
      )}
      {settled ? (
        <ReactMarkdown
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={REHYPE_PLUGINS}
          components={currentComponents}
        >
          {remend(sanitizeMd(settled))}
        </ReactMarkdown>
      ) : (
        trailing && (
          <p className="mb-2 whitespace-pre-wrap last:mb-0">
            <span key={text.length} className="word-reveal">
              {trailing}
            </span>
          </p>
        )
      )}
    </>
  )
}

const MessageBubble = memo(function MessageBubble({
  message,
  onEdit,
  onAnswerGeneral,
  onDeclineGeneral,
  onFeedback,
  onRegenerate,
}: {
  message: Message
  onEdit?: (text: string) => void
  onAnswerGeneral?: () => void
  onDeclineGeneral?: () => void
  onFeedback?: (rating: 'up' | 'down', detail?: { category?: string; comment?: string }) => void
  /** only ever passed for the last assistant message — re-asks its question in place */
  onRegenerate?: () => void
}) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  // Which source chip's passage popover is open, if any. Click-to-toggle so it
  // works on touch and keyboard, not just mouse hover.
  const [openSourceIdx, setOpenSourceIdx] = useState<number | null>(null)
  // "What went wrong?" popover for a down-vote, plus its optional detail fields.
  const [downOpen, setDownOpen] = useState(false)
  const [category, setCategory] = useState('')
  const [comment, setComment] = useState('')
  const [thanksVisible, setThanksVisible] = useState(false)
  const downTextareaRef = useRef<HTMLTextAreaElement>(null)
  const thanksTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (openSourceIdx === null && !downOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenSourceIdx(null)
        setDownOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openSourceIdx, downOpen])
  useEffect(() => {
    if (downOpen) downTextareaRef.current?.focus()
  }, [downOpen])
  useEffect(() => () => {
    if (thanksTimer.current) clearTimeout(thanksTimer.current)
  }, [])

  // Up: switch/record and show a brief "Thanks", no popover. Down: switch/record
  // and open the detail popover. Re-clicking the already-active thumb is a no-op.
  const handleUp = () => {
    if (message.rating === 'up') return
    setDownOpen(false)
    onFeedback?.('up')
    setThanksVisible(true)
    if (thanksTimer.current) clearTimeout(thanksTimer.current)
    thanksTimer.current = setTimeout(() => setThanksVisible(false), 1800)
  }
  const handleDown = () => {
    if (message.rating === 'down') return
    setThanksVisible(false)
    onFeedback?.('down')
    setCategory('')
    setComment('')
    setDownOpen(true)
  }
  const submitDetail = () => {
    onFeedback?.('down', { category: category || undefined, comment: comment || undefined })
    setDownOpen(false)
  }
  const cancelDetail = () => setDownOpen(false)

  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // clear the "Copied" reset timer if the bubble unmounts first (e.g. Clear session)
  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current)
  }, [])

  const copyText = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    navigator.clipboard.writeText(message.text).then(() => {
      setCopied(true)
      copyTimer.current = setTimeout(() => setCopied(false), 1500)
    })
  }

  if (isUser) {
    return (
      <div className="group/user message-in flex flex-col items-end gap-1">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground">
          {message.text}
        </div>
        {/* hover actions: edit (resend) · copy — like Claude */}
        <div className="flex items-center gap-2 opacity-0 transition focus-within:opacity-100 group-hover/user:opacity-100">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(message.text)}
              aria-label="Edit and resend"
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={copyText}
            aria-label="Copy message"
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          {message.ts && (
            <span className="font-mono text-[11px] text-muted-foreground/70">
              {formatTime(message.ts)}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="group message-in flex flex-col items-start gap-2">
      {/* aria-atomic="false" so assistive tech reads only what's newly added
          to this streaming container, not the whole answer over again on
          every token */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className={`w-full text-sm leading-relaxed text-card-foreground ${
          message.flash ? 'text-flash' : ''
        }`}
      >
        {/* render Markdown live so bold/tables/lists look right while streaming,
            not raw ** and <br>; word-reveal fades in the newest word while
            streaming; a caret marks that it's still typing */}
        <CruxMarkdown text={message.text} streaming={!message.done} />
        {!message.done && <span className="stream-caret" />}
      </div>

      {/* shown when the user pressed stop mid-answer */}
      {message.interrupted && (
        <span className="font-mono text-[11px] text-muted-foreground/80">
          Interrupted
        </span>
      )}

      {/* documents didn't cover this — ask before answering from general knowledge */}
      {message.done && message.notCovered && (
        <div className="fade-in flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Answer from general knowledge?</span>
          <button
            type="button"
            onClick={onAnswerGeneral}
            className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={onDeclineGeneral}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            No
          </button>
        </div>
      )}

      {/* meta row: source chips (click or hover to see the passage) · timestamp · copy-on-hover */}
      {message.done && (
        <div className="flex flex-wrap items-center gap-2">
          {message.sources && message.sources.length > 0 ? (
            message.sources.map((s, i) => (
              <button
                key={`${s.file}-${s.page}`}
                type="button"
                onClick={() => setOpenSourceIdx((cur) => (cur === i ? null : i))}
                aria-expanded={openSourceIdx === i}
                title="See the exact passage"
                className="citation-stamp inline-flex items-center gap-1.5 rounded-full border border-teal/40 bg-teal/10 px-3 py-1 font-mono text-xs text-teal transition hover:bg-teal/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {s.page ? `${s.file} · Page ${s.page}` : s.file}
              </button>
            ))
          ) : (
            message.grounded === false && (
              <span
                title="Answered from general knowledge, not your document"
                className="fade-in inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-muted-foreground"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                General knowledge
              </span>
            )
          )}

          {message.ts && (
            <span className="font-mono text-[11px] text-muted-foreground/70">
              {formatTime(message.ts)}
            </span>
          )}

          {onFeedback && (
            <div className="flex items-center gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handleUp}
                  aria-label="Good answer"
                  aria-pressed={message.rating === 'up'}
                  className={`flex items-center rounded-md p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    message.rating === 'up' ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill={message.rating === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6">
                    <path d="M7 22V11M2 13v7a2 2 0 0 0 2 2h12.5a2 2 0 0 0 1.98-1.7l1.2-8A2 2 0 0 0 17.7 10H14V5a2 2 0 0 0-2-2l-3 7v10" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={handleDown}
                    aria-label="Bad answer"
                    aria-pressed={message.rating === 'down'}
                    className={`flex items-center rounded-md p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                      message.rating === 'down' ? 'text-warn' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill={message.rating === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6">
                      <path d="M17 2v11M22 11V4a2 2 0 0 0-2-2H7.5a2 2 0 0 0-1.98 1.7l-1.2 8A2 2 0 0 0 6.3 14H10v5a2 2 0 0 0 2 2l3-7V2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* "what went wrong" detail popover — the down-vote itself already
                      posted on click; this only adds category/comment on Submit */}
                  {downOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={cancelDetail} />
                      <div className="fade-in absolute bottom-full right-0 z-50 mb-2 w-72 max-w-[85vw] rounded-xl border border-border bg-card p-3.5 shadow-lg">
                        <p className="mb-2 text-xs font-semibold text-foreground">What went wrong?</p>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          aria-label="What went wrong"
                          className="mb-2 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none"
                        >
                          <option value="">Choose a reason (optional)</option>
                          <option value="Wrong answer">Wrong answer</option>
                          <option value="Wrong citation">Wrong citation</option>
                          <option value="Too slow">Too slow</option>
                          <option value="Formatting">Formatting</option>
                          <option value="Other">Other</option>
                        </select>
                        <textarea
                          ref={downTextareaRef}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Tell us more (optional)"
                          aria-label="Tell us more"
                          rows={2}
                          className="mb-2.5 w-full resize-none rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelDetail}
                            className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={submitDetail}
                            className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                          >
                            Submit
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {thanksVisible && <span className="fade-in text-[11px] text-muted-foreground">Thanks</span>}
            </div>
          )}

          <button
            type="button"
            onClick={copyText}
            aria-label="Copy answer"
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground opacity-0 transition hover:text-foreground focus:opacity-100 group-hover:opacity-100"
          >
            {copied ? (
              <>
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="9" y="9" width="11" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Copy
              </>
            )}
          </button>

          {/* regenerate — only ever rendered for the last assistant answer
              (the caller only passes onRegenerate in that one case) */}
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              aria-label="Regenerate answer"
              title="Regenerate answer"
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground opacity-0 transition hover:text-foreground focus:opacity-100 group-hover:opacity-100"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 12a9 9 0 0 1 15.3-6.4M21 12a9 9 0 0 1-15.3 6.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18 3v4h-4M6 21v-4h4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Retry
            </button>
          )}
        </div>
      )}

      {/* expanded source passage — inline block below the chip row so it pushes
          later content down instead of overlaying it (was an absolute popover) */}
      {message.done && openSourceIdx !== null && message.sources?.[openSourceIdx]?.snippet && (
        <div className="fade-in max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-lg">
          <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-teal/70">
            Source passage
          </p>
          <p className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground">
            {message.sources[openSourceIdx].snippet}
          </p>
        </div>
      )}
    </div>
  )
})
