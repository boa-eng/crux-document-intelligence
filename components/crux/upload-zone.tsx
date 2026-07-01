'use client'

import { useRef, useState } from 'react'

const ACCEPTED = '.pdf,.docx,.txt,.xlsx'

export function UploadZone({
  onFiles,
}: {
  onFiles: (names: string[]) => void
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
    setTilt({ rx: -py * 4, ry: px * 4 })
  }

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
      className={`bracket-card group relative cursor-pointer overflow-hidden rounded-2xl border bg-card p-10 text-center transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        dragOver
          ? 'border-accent bg-accent/5'
          : 'border-border hover:border-accent/50'
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
          className="h-7 w-7 text-accent"
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

        <p className="mt-5 text-lg font-medium text-foreground">
          Drop a document, or click to choose one
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          PDF, DOCX, TXT, or XLSX — up to 200 pages each
        </p>

        <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Read in memory, never stored. It's gone the moment you close this tab.
        </p>

        <a
          href="https://github.com/boa-eng/rag-document-qa"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-4 text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          Read the source →
        </a>
      </div>
    </div>
  )
}
