// GSAP scroll choreography — starter implementation to be expanded during the build.
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function initScrollAnimations() {
  gsap.from('[data-animate="hero-title"]', { opacity: 0, y: 40, duration: 1, ease: 'power3.out' })
  gsap.from('[data-animate="hero-subtitle"]', { opacity: 0, y: 30, duration: 1, delay: 0.2, ease: 'power3.out' })

  gsap.utils.toArray('[data-animate="section"]').forEach((section) => {
    gsap.from(section, {
      opacity: 0,
      y: 60,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: section,
        start: 'top 80%',
      },
    })
  })
}
