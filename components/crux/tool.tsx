'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { ThinkingSkeleton } from './thinking-skeleton'

const MAX_MESSAGES = 15
const MAX_FILES = 10
const ACCEPTED = '.pdf,.docx,.txt,.xlsx'
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// Typewriter reveal pacing (chars per animation frame, ~60fps). Eases in:
// starts slow, multiplies by DRIP_RAMP each frame up to DRIP_MAX_SPEED. Lower
// DRIP_START_SPEED / DRIP_MAX_SPEED for an overall slower, calmer stream.
const DRIP_START_SPEED = 1.2 // ~72 chars/sec at the very start — deliberately slow
const DRIP_RAMP = 1.06 // acceleration per frame
const DRIP_MAX_SPEED = 40 // ceiling, ~2400 chars/sec when fully ramped

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
}

let idSeq = 1

/** Taglines rotate by day-of-month so they change daily without being random
 *  on every load. Document-work focused, Apple-level concise. */
const TAGLINES = [
  'The answer is already in there.',
  'Ask anything. Crux finds it.',
  'Every claim, backed by the source.',
  'Find the exact line, not a paraphrase.',
  'Cited sources. Every answer.',
  'Your documents are waiting.',
  'Precision retrieval. Plain language.',
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
  const [isGenerating, setIsGenerating] = useState(false)
  const [orbFading, setOrbFading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [fileLimitWarn, setFileLimitWarn] = useState(false)
  // answer depth, client-chosen (like Claude's model picker)
  const [effort, setEffort] = useState<'low' | 'medium' | 'high'>('medium')
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
  const genStartRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  // counts dragenter minus dragleave so crossing child elements doesn't flicker
  const dragDepth = useRef(0)

  // --- typewriter drip: reveal text at a steady pace, not in raw network bursts ---
  const dripTargetRef = useRef('') // full text received from the stream so far
  const dripShownRef = useRef(0) // how many chars are currently on screen
  const dripRafRef = useRef<number | null>(null)
  const dripDoneRef = useRef(false) // stream finished sending tokens
  const dripFinalRef = useRef<{ grounded: boolean; citations: Citation[] } | null>(null)
  const dripSpeedRef = useRef(0) // chars/frame, ramps up so reveal eases in slow→fast

  useEffect(
    () => () => {
      if (dripRafRef.current != null) cancelAnimationFrame(dripRafRef.current)
    },
    [],
  )

  // single source of truth: the rate-limit counter is just the user turns so far
  const messageCount = messages.filter((m) => m.role === 'user').length
  const remaining = MAX_MESSAGES - messageCount
  const hasDocs = files.length > 0
  const limitReached = remaining <= 0

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

    // advance the visible text toward what's been received. The reveal speed
    // eases IN — it starts slow and accelerates each frame (like Claude), which
    // feels steadier than a constant rate. A catch-up floor only engages when a
    // lot of text is buffered, so a big network burst never lags far behind.
    const dripTick = () => {
      const target = dripTargetRef.current
      const shown = dripShownRef.current
      if (shown < target.length) {
        const remaining = target.length - shown
        dripSpeedRef.current = Math.min(DRIP_MAX_SPEED, dripSpeedRef.current * DRIP_RAMP)
        const catchUp = remaining > 240 ? Math.ceil(remaining * 0.12) : 0
        const step = Math.min(
          remaining,
          Math.max(Math.round(dripSpeedRef.current), catchUp),
        )
        const next = Math.min(target.length, shown + step)
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
        body: JSON.stringify({ session_id: sessionId, message: question, history, effort, name: name || undefined }),
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
    setMessages((prev) => [
      ...prev,
      { id: idSeq++, role: 'user', text, done: true, ts: Date.now() },
    ])
    setInput('')

    // No upload required — with no session the backend answers from general
    // knowledge, so Crux works as a chatbot before any document is added.
    runQuery(text, history)
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
        ? 'text-amber-600'
        : 'text-muted-foreground'

  const showHeader = hasDocs || messages.length > 0

  return (
    <section id="tool" className="relative px-6 py-20 md:py-28">
      <div className="mx-auto max-w-3xl">
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
          className={`bracket-card overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors ${
            dragOver ? 'border-accent bg-accent/5' : 'border-border'
          }`}
        >
          {/* Notify bar — slim, top of panel, dismissible */}
          {notifyPromptVisible && (
            <div className="fade-in flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-2.5">
              <span className="text-sm text-foreground">
                Want to be notified when your answer is ready?
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleNotifyChoice(true)}
                  className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground transition hover:scale-[1.03]"
                >
                  Notify me
                </button>
                <button
                  onClick={() => setNotifyPromptVisible(false)}
                  aria-label="Dismiss"
                  className="rounded p-1 text-muted-foreground transition hover:text-foreground"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          )}

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
              <button
                onClick={clearSession}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-warn/50 hover:text-warn"
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
          )}

          {/* Messages */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="max-h-[600px] min-h-[320px] space-y-4 overflow-y-auto p-5"
          >
            {messages.length === 0 && !isGenerating && (
              <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-4 text-center">
                {greetingData.headline && (
                  <p className="max-w-sm font-heading text-[32px] font-semibold leading-tight tracking-tight text-foreground md:text-[40px]">
                    {greetingData.headline}
                  </p>
                )}

                {nameDone && greetingData.tagline && (
                  <p className="text-sm font-medium text-muted-foreground">
                    {greetingData.tagline}
                  </p>
                )}

                {!nameDone ? (
                  /* asked once on first load — Enter (filled or empty) moves on */
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      setName(nameDraft.trim())
                      setNameDone(true)
                    }}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <input
                      autoFocus
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder="What should I call you?"
                      className="w-56 rounded-full border border-border bg-surface px-4 py-1.5 text-center text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                    />
                    <span className="font-mono text-[11px] text-muted-foreground/70">
                      optional · press Enter to skip
                    </span>
                  </form>
                ) : !hasDocs ? (
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
                ) : null}
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onEdit={editMessage} />
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
            {messageCount > 0 && (
              <p className={`mb-2 text-right font-mono text-xs ${counterColor}`}>
                {remaining} message{remaining === 1 ? '' : 's'} remaining
              </p>
            )}

            <div className="rounded-2xl border border-border bg-surface px-3 pb-2.5 pt-3 transition focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(122,46,72,0.16)]">
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

              {/* upload status */}
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

              {/* input row: [+ add] [text] [send arrow] */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  send(input)
                }}
                className="flex items-end gap-2"
              >
                <input
                  ref={addInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED}
                  className="hidden"
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files ?? []))
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => addInputRef.current?.click()}
                  disabled={files.length >= MAX_FILES}
                  aria-label="Add documents"
                  title="Add documents"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-accent/50 hover:text-accent disabled:opacity-40"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                </button>

                <textarea
                  ref={inputRef}
                  value={input}
                  aria-label="Ask a question about your document"
                  rows={1}
                  onChange={(e) => {
                    setInput(e.target.value)
                    // auto-grow up to a few lines
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
                    // Collapse into a chip only for genuinely large pastes
                    // (documents, articles). A list of 10 questions is ~600 chars
                    // and should stay inline so the user can still edit it.
                    const clip = e.clipboardData.getData('text')
                    if (clip.length > 1200) {
                      e.preventDefault()
                      setPasted((prev) => (prev ? `${prev}\n\n${clip}` : clip))
                    }
                  }}
                  disabled={limitReached}
                  placeholder={
                    hasDocs ? 'Ask anything about your document…' : 'Write a message…'
                  }
                  className="min-w-0 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
                />

                {isGenerating ? (
                  <button
                    type="button"
                    onClick={stopGenerating}
                    aria-label="Stop"
                    title="Stop generating"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition hover:scale-105"
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
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition enabled:hover:scale-105 disabled:opacity-30"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </form>

              {/* effort — the client picks how hard the model thinks */}
              <div className="mt-2 flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground/70">Effort:</span>
                {(
                  [
                    ['low', 'Low'],
                    ['medium', 'Medium'],
                    ['high', 'High'],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    aria-pressed={effort === val}
                    onClick={() => setEffort(val)}
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] transition ${
                      effort === val
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Crux can make mistakes. Double-check the source.
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
    <pre className="my-3 overflow-x-auto rounded-xl bg-zinc-900 p-4 text-[12px] font-mono leading-relaxed text-zinc-200" {...props} />
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

function CruxMarkdown({ text }: { text: string }) {
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

const MessageBubble = memo(function MessageBubble({
  message,
  onEdit,
}: {
  message: Message
  onEdit?: (text: string) => void
}) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [hoverSnippet, setHoverSnippet] = useState<string | null>(null)
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
        <div className="flex items-center gap-2 opacity-0 transition group-hover/user:opacity-100">
          {onEdit && (
            <button
              onClick={() => onEdit(message.text)}
              aria-label="Edit and resend"
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition hover:text-foreground"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Edit
            </button>
          )}
          <button
            onClick={copyText}
            aria-label="Copy message"
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition hover:text-foreground"
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
      <div
        className={`max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-card-foreground ${
          message.flash ? 'border-flash' : ''
        }`}
      >
        {/* render Markdown live so bold/tables/lists look right while streaming,
            not raw ** and <br>; a caret marks that it's still typing */}
        <CruxMarkdown text={message.text} />
        {!message.done && <span className="stream-caret" />}
      </div>

      {/* shown when the user pressed stop mid-answer */}
      {message.interrupted && (
        <span className="font-mono text-[11px] text-muted-foreground/80">
          Interrupted
        </span>
      )}

      {/* meta row: source chips (hover to see the passage) · timestamp · copy-on-hover */}
      {message.done && (
        <div className="flex flex-wrap items-center gap-2">
          {message.sources && message.sources.length > 0 ? (
            message.sources.map((s) => (
              <span
                key={`${s.file}-${s.page}`}
                onMouseEnter={() => setHoverSnippet(s.snippet ?? null)}
                onMouseLeave={() => setHoverSnippet(null)}
                title="Hover to see the exact passage"
                className="fade-in inline-flex cursor-help items-center gap-1.5 rounded-full border border-teal/40 bg-teal/10 px-3 py-1 font-mono text-xs text-teal transition hover:bg-teal/20"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {s.page ? `${s.file} · Page ${s.page}` : s.file}
              </span>
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

          <button
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
        </div>
      )}

      {/* passage card — appears below the chips when hovering a source */}
      {message.done && hoverSnippet && (
        <div className="fade-in max-w-[85%] rounded-lg border border-teal/30 bg-teal/5 px-3.5 py-2.5">
          <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-teal/70">
            Source passage
          </p>
          <p className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
            {hoverSnippet}
          </p>
        </div>
      )}
    </div>
  )
})
