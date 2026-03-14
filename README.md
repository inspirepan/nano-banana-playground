# Nano Banana Playground

A pure frontend playground for Gemini image generation. No backend — your API key stays in the browser.

![Screenshot](docs/screenshot.jpeg)

## Features

- **Nano Banana 2** (`gemini-3.1-flash-image-preview`) and **Nano Banana Pro** — switch models instantly
- Resolution: 512 / 1K / 2K / 4K
- 12 aspect ratios with pixel dimensions preview
- Batch generation up to 4 images at once
- Reference image upload (drag & drop)
- History stored locally in IndexedDB — no server, no account
- Dark mode

## Getting Started

**Prerequisites:** Node.js 18+, a [Gemini API key](https://aistudio.google.com/apikey)

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open http://localhost:5173, paste your Gemini API key, and start generating.

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

## Deploy

Deployed to Cloudflare Pages via GitHub Actions on every push to `main`.

Live: https://banana.jixiang.dev
