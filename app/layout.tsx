import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['400'],
})

export const metadata: Metadata = {
  title: 'Crux. The answer is in there. Crux finds it.',
  description:
    'Ask your documents anything. Get the answer. See exactly where it came from. Processed in memory, deleted on close. Built for teams who can\u2019t afford wrong answers.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  // dark-glass branch: browser chrome (mobile address bar, form controls)
  // should match the ink page, not the old paper
  colorScheme: 'dark',
  themeColor: '#141110',
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        {/* Paper grain: a faint noise texture over the whole page so the flat
            "Paper and Ink" background reads as paper, not a digital fill.
            First child so it sits behind all real content (see z-index in
            .grain-overlay); aria-hidden because it's pure decoration. */}
        <div className="grain-overlay" aria-hidden="true" />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
