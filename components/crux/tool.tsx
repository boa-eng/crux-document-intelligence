'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { UploadZone } from './upload-zone'
import { ThinkingOrb } from './thinking-orb'

const MAX_MESSAGES = 15

type Mode = 'general' | 'document' | 'not_found'

type Message = {
  id: number
  role: 'user' | 'crux'
  text: string
  mode?: Mode
  source?: { file: string; page: string }
  done?: boolean
  flash?: boolean
}

let idSeq = 1

export function Tool() {
  const [files, setFiles] = useState<string[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [orbFading, setOrbFading] = useState(false)
  const [messageCount, setMessageCount] = useState(0)

  // nudge: shown once per session, only in Mode 1
  const [nudgeVisible, setNudgeVisible] = useState(false)
  const nudgeUsedRef = useRef(false)

  // not_found inline card targets a specific user message
  const [notFound, setNotFound] = useState<{ message: string } | null>(null)

  // notification permission flow
  const [notifyPromptVisible, setNotifyPromptVisible] = useState(false)
  const notifyAskedRef = useRef(false)
  const notifyAllowedRef = useRef(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const genStartRef = useRef(0)

  const remaining = MAX_MESSAGES - messageCount
  const hasDocs = files.length > 0
  const limitReached = remaining <= 0

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, isGenerating])

  const fireNotification = useCallback((elapsed: number) => {
    // Only notify if it took >5s, tab not focused, and permission granted
    if (elapsed < 5000) return
    if (typeof document !== 'undefined' && document.hasFocus()) return
    if (!notifyAllowedRef.current) return
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Crux', { body: 'Your answer is ready.' })
    }
  }, [])

  /**
   * Mock backend. Replace with: POST /chat
   *   body: { message, session_id, history, force_general?: bool }
   *   returns: SSE stream of tokens; final frame carries `mode`.
   */
  const getMockResponse = (
    message: string,
    forceGeneral: boolean,
  ): { answer: string; mode: Mode; source?: { file: string; page: string } } => {
    if (!hasDocs || forceGeneral) {
      return {
        mode: 'general',
        answer:
          'Answering from general knowledge. This is a working UI demo — once Crux is connected to its backend, this exact response area will stream the model output token by token over SSE. Upload a document and I will ground every answer in your content instead, citing the precise page it came from.',
      }
    }
    // proxy for "not relevant to the uploaded docs": very short query
    if (message.trim().length < 8) {
      return {
        mode: 'not_found',
        answer: '',
      }
    }
    return {
      mode: 'document',
      answer:
        'Based on the document you uploaded, here is the grounded answer. When the backend is live, this text streams from the retrieved passages and the chip below shows the exact filename and page so you can verify it in one click.',
      source: { file: files[0] ?? 'document.pdf', page: '14' },
    }
  }

  const streamAnswer = async (msgId: number, answer: string) => {
    const words = answer.split(' ')
    let acc = ''
    for (const word of words) {
      acc += (acc ? ' ' : '') + word
      const current = acc
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, text: current } : m)),
      )
      // ~35ms/word with slight human variation (30–45ms)
      // TODO: replace with real SSE stream
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 15))
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, done: true, flash: true } : m,
      ),
    )
    const elapsed = performance.now() - genStartRef.current
    fireNotification(elapsed)
  }

  const runQuery = async (message: string, forceGeneral = false) => {
    setIsGenerating(true)
    setOrbFading(false)
    genStartRef.current = performance.now()

    // brief "thinking" beat before the first token
    await new Promise((r) => setTimeout(r, 700 + Math.random() * 500))

    const res = getMockResponse(message, forceGeneral)

    if (res.mode === 'not_found') {
      setOrbFading(true)
      await new Promise((r) => setTimeout(r, 300))
      setIsGenerating(false)
      setNotFound({ message })
      return
    }

    // crossfade orb out, then mount the streaming bubble
    setOrbFading(true)
    await new Promise((r) => setTimeout(r, 300))
    setIsGenerating(false)

    const msgId = idSeq++
    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        role: 'crux',
        text: '',
        mode: res.mode,
        source: res.source,
      },
    ])

    await streamAnswer(msgId, res.answer)

    // Mode 1: soft nudge after first general answer (once per session)
    if (res.mode === 'general' && !hasDocs && !nudgeUsedRef.current) {
      nudgeUsedRef.current = true
      setNudgeVisible(true)
    }
  }

  const send = (rawText: string) => {
    const text = rawText.trim()
    if (!text || isGenerating || limitReached) return

    // ask for notification permission once, on first message
    if (!notifyAskedRef.current) {
      notifyAskedRef.current = true
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'default'
      ) {
        setNotifyPromptVisible(true)
      }
    }

    setMessages((prev) => [
      ...prev,
      { id: idSeq++, role: 'user', text, done: true },
    ])
    setMessageCount((c) => c + 1)
    setInput('')
    setNotFound(null)
    runQuery(text)
  }

  const resolveNotFound = (useGeneral: boolean) => {
    const pending = notFound
    setNotFound(null)
    if (useGeneral && pending) {
      // re-POST /chat with force_general: true
      runQuery(pending.message, true)
    }
  }

  const handleNotifyChoice = (allow: boolean) => {
    setNotifyPromptVisible(false)
    if (allow && typeof Notification !== 'undefined') {
      Notification.requestPermission().then((perm) => {
        notifyAllowedRef.current = perm === 'granted'
      })
    }
    // "Not now" -> never ask again (notifyAskedRef already true)
  }

  const clearSession = () => {
    // TODO: POST /clear -> wipes session index + history
    setFiles([])
    setMessages([])
    setMessageCount(0)
    setNotFound(null)
    setNudgeVisible(false)
    nudgeUsedRef.current = false
  }

  const counterColor =
    remaining <= 0
      ? 'text-warn'
      : remaining <= 3
        ? 'text-amber-400'
        : 'text-muted-foreground'

  return (
    <section id="tool" className="relative px-6 py-20 md:py-28">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs tracking-[0.25em] text-muted-foreground">
            THE 30-SECOND TEST
          </p>
          <h2 className="mt-3 font-heading text-2xl font-bold tracking-tight md:text-3xl">
            Ask a question. Get the answer.
          </h2>
        </div>

        {/* Upload zone */}
        <UploadZone
          files={files}
          onFiles={(names) =>
            setFiles((prev) => Array.from(new Set([...prev, ...names])).slice(0, 5))
          }
          onClear={() => setFiles([])}
        />

        {/* Chat panel */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface/70 glass">
          {/* messages */}
          <div
            ref={scrollRef}
            className="max-h-[420px] min-h-[180px] space-y-4 overflow-y-auto p-5"
          >
            {messages.length === 0 && !isGenerating && (
              <div className="flex h-full min-h-[140px] flex-col items-center justify-center text-center">
                <p className="text-sm text-muted-foreground">
                  {hasDocs
                    ? 'Ask anything about your documents.'
                    : 'Ask me anything to get started — no upload required.'}
                </p>
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}

            {isGenerating && (
              <div className="message-in">
                <ThinkingOrb fading={orbFading} />
              </div>
            )}

            {/* Mode 2: not_found inline card */}
            {notFound && (
              <div className="fade-in rounded-xl border border-accent/40 bg-card p-4">
                <p className="text-sm text-foreground">
                  Your documents don&apos;t cover this one. Answer from general
                  knowledge?
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => resolveNotFound(true)}
                    className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground transition hover:scale-[1.02]"
                  >
                    Yes, go ahead
                  </button>
                  <button
                    onClick={() => resolveNotFound(false)}
                    className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground transition hover:border-accent/50"
                  >
                    No, keep it grounded
                  </button>
                </div>
              </div>
            )}

            {/* Mode 1: soft upload nudge (once per session) */}
            {nudgeVisible && (
              <div className="fade-in relative rounded-xl border border-accent/40 bg-card p-4">
                <button
                  onClick={() => setNudgeVisible(false)}
                  aria-label="Dismiss"
                  className="absolute right-3 top-3 text-muted-foreground transition hover:text-foreground"
                >
                  ✕
                </button>
                <p className="pr-6 text-sm leading-relaxed text-foreground">
                  Have a specific document? Upload it and I&apos;ll answer from
                  your exact content instead — with the page it came from.
                </p>
                <button
                  onClick={() => {
                    setNudgeVisible(false)
                    document
                      .getElementById('tool')
                      ?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="mt-3 text-xs font-semibold text-accent hover:underline"
                >
                  Upload document →
                </button>
              </div>
            )}

            {/* limit reached card */}
            {limitReached && (
              <div className="fade-in rounded-xl border border-warn/40 bg-card p-4 text-center">
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

          {/* input area */}
          <div className="border-t border-border p-4">
            {messageCount > 0 && (
              <p
                className={`mb-2 text-right font-mono text-xs ${counterColor}`}
              >
                {remaining} message{remaining === 1 ? '' : 's'} remaining
              </p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                send(input)
              }}
              className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-2 py-2 transition focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(59,126,255,0.15)]"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={limitReached}
                placeholder={
                  hasDocs
                    ? 'Ask anything about your documents...'
                    : 'Ask me anything...'
                }
                className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={limitReached || isGenerating || !input.trim()}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground transition enabled:hover:scale-[1.02] disabled:opacity-40"
              >
                Ask
              </button>
            </form>

            {/* notification permission — subtle inline prompt */}
            {notifyPromptVisible && (
              <div className="fade-in mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  Get notified when your answer is ready?
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleNotifyChoice(true)}
                    className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground"
                  >
                    Allow
                  </button>
                  <button
                    onClick={() => handleNotifyChoice(false)}
                    className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-foreground"
                  >
                    Not now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Clear button */}
        {(messages.length > 0 || hasDocs) && (
          <div className="mt-6 text-center">
            <button
              onClick={clearSession}
              className="font-mono text-xs text-muted-foreground transition hover:text-warn"
            >
              Clear session &amp; delete documents
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="message-in flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground">
          {message.text}
        </div>
      </div>
    )
  }

  return (
    <div className="message-in flex flex-col items-start gap-2">
      <div
        className={`max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 text-sm leading-relaxed text-card-foreground ${
          message.flash ? 'border-flash' : ''
        }`}
      >
        <span className={message.done ? '' : 'stream-cursor'}>
          {message.text}
        </span>
      </div>

      {/* source chip — document mode only */}
      {message.done && message.mode === 'document' && (
        <div className="fade-in flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal/40 bg-teal/10 px-3 py-1 font-mono text-xs text-teal">
            {/* TODO: replace with `${message.source.file} · Page ${message.source.page}` from backend */}
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {message.source
              ? `${message.source.file} · Page ${message.source.page}`
              : 'Source shown on every answer'}
          </span>
        </div>
      )}
    </div>
  )
}
