'use client'

import { useState } from 'react'
import { useReveal } from './use-reveal'

const INDUSTRIES = ['Legal', 'Medical', 'Finance', 'HR', 'Engineering', 'Other']

export function FinalCta() {
  const { ref, visible } = useReveal<HTMLDivElement>()
  const [form, setForm] = useState({
    name: '',
    company: '',
    industry: '',
    message: '',
  })
  const [submitted, setSubmitted] = useState(false)

  const update = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: POST lead to backend / scheduling provider
    setSubmitted(true)
  }

  const openWhatsApp = () => {
    const text = encodeURIComponent(
      `Hi Crux, I'm ${form.name || 'interested'} from ${form.company || 'a team'}. ${form.message || 'I\u2019d love to see Crux on our documents.'}`,
    )
    // TODO: replace with the real WhatsApp business number
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  const inputClass =
    'w-full rounded-lg border border-border bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20'

  return (
    <section id="contact" className="px-6 py-28">
      <div
        ref={ref}
        className={`mx-auto max-w-xl text-center reveal ${visible ? 'is-visible' : ''}`}
      >
        <h2 className="font-heading text-4xl font-extrabold leading-[1.1] tracking-tight text-balance md:text-5xl">
          YOUR DOCUMENTS ARE WAITING.
        </h2>
        <p className="mt-5 text-lg font-medium leading-relaxed text-muted-foreground">
          Tell us what you&apos;re working with. We&apos;ll show you Crux in
          action on your files.
        </p>

        {submitted ? (
          <div className="mt-10 rounded-2xl border border-teal/40 bg-card p-8">
            <p className="font-heading text-xl font-bold">Thanks, {form.name || 'there'}.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              We&apos;ll be in touch within one business day.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-10 flex flex-col gap-3 text-left"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                required
                placeholder="Name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                className={inputClass}
              />
              <input
                placeholder="Company"
                value={form.company}
                onChange={(e) => update('company', e.target.value)}
                className={inputClass}
              />
            </div>
            <select
              value={form.industry}
              onChange={(e) => update('industry', e.target.value)}
              className={`${inputClass} ${form.industry ? '' : 'text-muted-foreground'}`}
            >
              <option value="" disabled>
                Industry
              </option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i} className="text-foreground">
                  {i}
                </option>
              ))}
            </select>
            <textarea
              rows={3}
              placeholder="What documents are you working with?"
              value={form.message}
              onChange={(e) => update('message', e.target.value)}
              className={`${inputClass} resize-none`}
            />

            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground shadow-[0_0_30px_-6px_var(--accent)] transition hover:scale-[1.02] hover:shadow-[0_0_40px_0px_var(--accent)] active:scale-[0.98]"
              >
                Book a 15-minute call →
              </button>
              <button
                type="button"
                onClick={openWhatsApp}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card/40 px-6 py-3.5 text-sm font-semibold text-foreground transition hover:border-whatsapp/60"
              >
                <svg
                  className="h-4 w-4 text-whatsapp"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.5 14.4c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4 0 1.4 1 2.8 1.2 3 .1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2z" />
                </svg>
                Message on WhatsApp →
              </button>
            </div>

            <p className="mt-3 text-center font-mono text-xs text-muted-foreground">
              We reply within one business day.
            </p>
          </form>
        )}
      </div>
    </section>
  )
}
