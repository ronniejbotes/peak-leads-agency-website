// Landing page entry point.
import '../styles/main.css'
import { initHeroScene } from './three/heroScene.js'
import { initScrollAnimations } from './animations/scroll.js'

initHeroScene(document.querySelector('#hero-canvas'))
initScrollAnimations()
