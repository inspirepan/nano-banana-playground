import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // heic2any is a lazy-loaded single-file HEIC fallback converter.
    chunkSizeWarningLimit: 1500,
  },
})
