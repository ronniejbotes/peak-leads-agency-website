# Peak Leads — Agency Website

Hybrid multi-page static site: a feature-rich landing page (3D canvases reacting to mouse
movement and scroll) plus simpler inner pages. Builds to plain static files, hosted on
**Hostinger** (Business plan, no Node server required).

## Stack

- **[Vite](https://vitejs.dev)** — dev server + static build, multi-page setup
- **[Tailwind CSS v4](https://tailwindcss.com)** — styling (theme tokens in `src/styles/main.css`)
- **[Three.js](https://threejs.org)** — 3D canvas scenes (mouse + scroll reactive)
- **[GSAP + ScrollTrigger](https://gsap.com)** — scroll choreography and micro-animations
- **Higgsfield MCP** — generates the site's images / videos / 3D models (saved into `public/assets/`)

## Commands

```bash
npm install        # once
npm run dev        # dev server with hot reload
npm run build      # production build → dist/
npm run preview    # preview the production build locally
```

## Structure

```
index.html               Landing page (all the 3D / scroll features)
about/index.html         Inner page  → /about/
services/index.html      Inner page  → /services/
contact/index.html       Inner page  → /contact/
src/
  styles/main.css        Tailwind import + brand theme tokens
  js/main.js             Landing page entry
  js/pages/subpage.js    Shared entry for inner pages (no Three.js bundle)
  js/three/              3D scenes (heroScene.js = starter mouse/scroll-reactive scene)
  js/animations/         GSAP scroll animations
public/
  assets/images/         Higgsfield-generated images
  assets/videos/         Higgsfield-generated videos
  assets/models/         3D models (GLB)
  fonts/                 Self-hosted fonts
```

New pages: create `<name>/index.html`, add it to `build.rollupOptions.input` in
`vite.config.js`.

## Deploying to Hostinger

The site builds to plain static files, so both hPanel options work. In
hPanel → **Add website**, pick one of:

### Option A — Deploy Web App (recommended)

Hostinger's JS web app deployment, connected to this GitHub repo:

- Source: GitHub → this repository, branch `main`
- Build command: `npm run build`
- Output directory: `dist`

Every push to `main` then auto-builds and deploys.

### Option B — Custom PHP/HTML website

Manual static upload:

1. `npm run build` — output lands in `dist/`
2. Upload the **contents** of `dist/` into `public_html/` (hPanel File Manager or FTP)

No server configuration needed either way — there is no backend.
