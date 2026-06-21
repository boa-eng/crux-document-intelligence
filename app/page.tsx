import { AnimatedBackground } from '@/components/crux/animated-background'
import { Hero } from '@/components/crux/hero'
import { Tool } from '@/components/crux/tool'
import { Tension } from '@/components/crux/tension'
import { Stats } from '@/components/crux/stats'
import { Demos } from '@/components/crux/demos'
import { Process } from '@/components/crux/process'
import { WhyCrux } from '@/components/crux/why-crux'
import { Testimonials } from '@/components/crux/testimonials'
import { TrustStrip } from '@/components/crux/trust-strip'
import { FinalCta } from '@/components/crux/final-cta'
import { Footer } from '@/components/crux/footer'

export default function Page() {
  return (
    <>
      <AnimatedBackground />
      <main className="relative">
        <Hero />
        <Tool />
        <Tension />
        <Stats />
        <Demos />
        <Process />
        <WhyCrux />
        <Testimonials />
        <TrustStrip />
        <FinalCta />
        <Footer />
      </main>
    </>
  )
}
