import { AnimatedBackground } from '@/components/crux/animated-background'
import { StickyBar } from '@/components/crux/sticky-bar'
import { Hero } from '@/components/crux/hero'
import { Tool } from '@/components/crux/tool'
import { Tension } from '@/components/crux/tension'
import { Stats } from '@/components/crux/stats'
import { Demos } from '@/components/crux/demos'
import { Process } from '@/components/crux/process'
import { ProofPanel } from '@/components/crux/proof-panel'
import { WhyCrux } from '@/components/crux/why-crux'
import { Testimonials } from '@/components/crux/testimonials'
import { TrustStrip } from '@/components/crux/trust-strip'
import { IndustryStrip } from '@/components/crux/industry-strip'
import { PricingAnatomy } from '@/components/crux/pricing-anatomy'
import { FinalCta } from '@/components/crux/final-cta'
import { Footer } from '@/components/crux/footer'

export default function Page() {
  return (
    <>
      <AnimatedBackground />
      <StickyBar />
      <main className="relative">
        <Hero />
        <Tool />
        <Tension />
        <Stats />
        <IndustryStrip />
        <Demos />
        <Process />
        <WhyCrux />
        <ProofPanel />
        <Testimonials />
        <TrustStrip />
        <PricingAnatomy />
        <FinalCta />
        <Footer />
      </main>
    </>
  )
}
