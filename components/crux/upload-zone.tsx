'use client'

import { useRef, useState } from 'react'

const ACCEPTED = '.pdf,.docx,.txt,.xlsx'
const BADGES = ['PDF', 'DOCX', 'TXT', 'XLSX']

export function UploadZone({
  files,
  onFiles,
  onClear,
}: {
  files: string[]
  onFiles: (names: string[]) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })

  const handleSelected = (list: FileList | null) => {
    if (!list || list.length === 0) return
    const names = Array.from(list).map((f) => f.name)
    // TODO: POST /upload — FormData -> { session_id, file_count, page_count }
    onFiles(names)
  }

  const handleTilt = (e: React.MouseEvent) => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    setTilt({ rx: -py * 5, ry: px * 5 })
  }

  // ---- Accepted (slim pill) state ----
  if (files.length > 0) {
    return (
      <div className="fade-in flex items-center justify-between gap-3 rounded-xl border border-teal/40 bg-card px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <svg
            className="h-5 w-5 shrink-0 text-teal"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="truncate text-sm font-medium">
            {files.length === 1
              ? files[0]
              : `${files.length} documents loaded`}
          </span>
        </div>
        <button
          onClick={onClear}
          className="shrink-0 font-mono text-xs text-muted-foreground transition-colors hover:text-warn"
        >
          × clear
        </button>
      </div>
    )
  }

  // ---- Empty / drop state ----
  return (
    <div
      ref={cardRef}
      onMouseMove={handleTilt}
      onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        handleSelected(e.dataTransfer.files)
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        transition: 'transform 0.15s ease-out',
      }}
      className={`glass group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed p-8 text-center transition-colors duration-200 ${
        dragOver
          ? 'border-accent bg-accent/5'
          : 'border-accent/40 hover:border-accent/70'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => handleSelected(e.target.files)}
      />

      {/* inner glow */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center">
        <svg
          className="h-6 w-6 text-accent"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 18v-6M9 15h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <p className="mt-4 text-base font-semibold">Drop your documents here</p>
        <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>

        <p className="mt-4 font-mono text-xs text-muted-foreground">
          PDF · DOCX · TXT · XLSX — up to 200 pages each · processed in memory
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {BADGES.map((b) => (
            <span
              key={b}
              className="rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
            >
              {b}
            </span>
          ))}
        </div>

        <p className="mt-5 max-w-sm text-xs leading-relaxed text-muted-foreground">
          No signup. No storage. Documents deleted the moment you close this tab.
        </p>

        <a
          href="#"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 text-xs font-medium text-teal underline-offset-4 hover:underline"
        >
          Don&apos;t trust us? Read the source code →
        </a>

        <p className="mt-4 font-mono text-[11px] text-muted-foreground">
          Free: 5 documents · 15 messages
        </p>
      </div>
    </div>
  )
}
