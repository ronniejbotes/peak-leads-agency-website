// Hero 3D scene — starter implementation to be replaced with the real design.
// Demonstrates the two required interactions: mouse-move parallax and scroll reaction.
import * as THREE from 'three'

export function initHeroScene(canvas) {
  if (!canvas) return

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 100)
  camera.position.z = 5

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)

  // Placeholder object: wireframe icosahedron + particle field
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.6, 1),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true })
  )
  scene.add(mesh)

  const particleCount = 800
  const positions = new Float32Array(particleCount * 3)
  for (let i = 0; i < particleCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 20
  }
  const particleGeometry = new THREE.BufferGeometry()
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.02, transparent: true, opacity: 0.6 })
  )
  scene.add(particles)

  // Mouse parallax (normalized -1..1, eased in the render loop)
  const mouse = { x: 0, y: 0 }
  window.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1
    mouse.y = -((e.clientY / window.innerHeight) * 2 - 1)
  })

  // Scroll reaction (0 at top, grows as the user scrolls)
  let scrollProgress = 0
  window.addEventListener('scroll', () => {
    scrollProgress = window.scrollY / window.innerHeight
  }, { passive: true })

  window.addEventListener('resize', () => {
    camera.aspect = canvas.clientWidth / canvas.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
  })

  const clock = new THREE.Clock()
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime()

    mesh.rotation.x = t * 0.15 + scrollProgress * 1.5
    mesh.rotation.y = t * 0.2 + scrollProgress
    particles.rotation.y = t * 0.02

    camera.position.x += (mouse.x * 0.6 - camera.position.x) * 0.05
    camera.position.y += (mouse.y * 0.6 - camera.position.y) * 0.05
    camera.lookAt(scene.position)

    renderer.render(scene, camera)
  })
}
