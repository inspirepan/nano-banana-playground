import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function packageChunkName(id: string): string | undefined {
  const marker = '/node_modules/'
  const normalized = id.replaceAll('\\', '/')
  const index = normalized.lastIndexOf(marker)
  if (index < 0) return undefined

  const packagePath = normalized.slice(index + marker.length)
  const parts = packagePath.split('/')
  const packageName = parts[0]?.startsWith('@') ? `${parts[0]}-${parts[1]}` : parts[0]
  return packageName ? `vendor-${packageName.replaceAll('@', '').replaceAll('.', '-')}` : undefined
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      'node:fs': fileURLToPath(new URL('./src/lib/nodeShims/fs.ts', import.meta.url)),
      'node:os': fileURLToPath(new URL('./src/lib/nodeShims/os.ts', import.meta.url)),
      'node:path': fileURLToPath(new URL('./src/lib/nodeShims/path.ts', import.meta.url)),
    },
  },
  build: {
    // heic2any is a lazy-loaded single-file HEIC fallback converter.
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react'
          if (id.includes('/lucide-react/')) return 'vendor-lucide'
          if (id.includes('/agentation/')) return 'vendor-agentation'
          if (id.includes('/@mariozechner+pi-agent') || id.includes('/@mariozechner/pi-agent/')) {
            return 'vendor-pi-agent'
          }
          if (id.includes('/@mariozechner+pi-ai') || id.includes('/@mariozechner/pi-ai/')) return 'vendor-pi-ai'
          if (id.includes('/streamdown/')) return 'vendor-markdown'
          if (id.includes('/@google+genai') || id.includes('/@google/genai/')) return 'vendor-google-genai'
          return packageChunkName(id)
        },
      },
    },
  },
})
