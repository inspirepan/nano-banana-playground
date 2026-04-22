import type { BrotliWasmType } from 'brotli-wasm'
import type { PersistedPromptMode } from './types'

// --- Compression ---

const BROTLI_QUALITY = 6

let brotliPromise: Promise<BrotliWasmType> | null = null

function getBrotli(): Promise<BrotliWasmType> {
  if (brotliPromise === null) {
    brotliPromise = import('brotli-wasm').then((module) => module.default)
  }
  return brotliPromise
}

export function preloadStateBlobCodec(): void {
  void getBrotli()
}

async function compress(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const brotli = await getBrotli()
  const result = brotli.compress(bytes, { quality: BROTLI_QUALITY })

  // base64url (URL-safe, no padding)
  return btoa(String.fromCharCode(...result))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function decompress(b64url: string): Promise<string> {
  // Restore standard base64
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '=='.slice(0, (4 - (b64.length % 4)) % 4)
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
  const brotli = await getBrotli()
  const result = brotli.decompress(bytes)

  return new TextDecoder().decode(result)
}

// --- State blob: all prompt-related state in one compressed param (s) ---

export type StateBlob = {
  prompt: string
  schemes: Array<{ title: string; description: string; text: string }>
  originalPrompt: string | null
  mode: PersistedPromptMode
  currentSchemeIndex: number
}

// Compact: [prompt, [[title, desc, text], ...], originalPrompt, mode(0|1), schemeIndex]
type CompactScheme = [title: string, description: string, text: string]

type CompactStateBlob = [
  prompt: string,
  schemes: CompactScheme[],
  originalPrompt: string | null,
  mode: 0 | 1,
  currentSchemeIndex: number,
]

function isCompactStateBlob(value: unknown): value is CompactStateBlob {
  if (!Array.isArray(value) || value.length !== 5) return false
  const [prompt, schemes, originalPrompt, mode, currentSchemeIndex] = value
  if (typeof prompt !== 'string' || !Array.isArray(schemes)) return false
  if (originalPrompt !== null && typeof originalPrompt !== 'string') return false
  if (mode !== 0 && mode !== 1) return false
  if (!Number.isInteger(currentSchemeIndex) || currentSchemeIndex < 0) return false
  for (const s of schemes) {
    if (!Array.isArray(s) || s.length !== 3) return false
    if (s.some((v) => typeof v !== 'string')) return false
  }
  return true
}

export async function compressStateBlob(data: StateBlob): Promise<string> {
  const compact: CompactStateBlob = [
    data.prompt,
    data.schemes.map((s): CompactScheme => [s.title, s.description, s.text]),
    data.originalPrompt,
    data.mode === 'structured' ? 1 : 0,
    data.currentSchemeIndex,
  ]
  return compress(JSON.stringify(compact))
}

export async function decompressStateBlob(b64url: string): Promise<StateBlob> {
  const json = await decompress(b64url)
  const raw = JSON.parse(json) as unknown
  if (!isCompactStateBlob(raw)) throw new Error('Invalid state blob')
  const [prompt, schemes, originalPrompt, mode, currentSchemeIndex] = raw
  return {
    prompt,
    schemes: schemes.map(([title, description, text]) => ({ title, description, text })),
    originalPrompt,
    mode: mode === 1 ? 'structured' : 'text',
    currentSchemeIndex,
  }
}

// --- Simple (non-compressed) URL params: model/resolution/ratio/quality/batch ---

export type SimpleUrlParams = {
  modelId: string | null
  resolution: string | null
  aspectRatio: string | null
  quality: string | null
  batchCount: number | null
}

export function readSimpleUrlParams(): SimpleUrlParams {
  const params = new URLSearchParams(window.location.search)
  const nRaw = params.get('n')
  const n = nRaw !== null ? parseInt(nRaw, 10) : null
  return {
    modelId: params.get('m'),
    resolution: params.get('r'),
    aspectRatio: params.get('a'),
    quality: params.get('q'),
    batchCount: n !== null && !isNaN(n) ? n : null,
  }
}

export function readStateBlobParam(): string | null {
  return new URLSearchParams(window.location.search).get('s')
}

// --- URL writer ---

// Updates a subset of URL params via replaceState (no history entry added)
export function updateUrl(updates: Record<string, string | null>): void {
  const params = new URLSearchParams(window.location.search)
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }
  const search = params.toString()
  const url = search ? `${window.location.pathname}?${search}` : window.location.pathname
  window.history.replaceState(null, '', url)
}
