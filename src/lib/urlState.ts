import type { PromptScheme } from './types'

// --- Compression ---

async function compress(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const stream = new CompressionStream('brotli')
  const writer = stream.writable.getWriter()
  writer.write(bytes)
  writer.close()

  const chunks: Uint8Array[] = []
  const reader = stream.readable.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

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

  const stream = new DecompressionStream('brotli')
  const writer = stream.writable.getWriter()
  writer.write(bytes)
  writer.close()

  const chunks: Uint8Array[] = []
  const reader = stream.readable.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return new TextDecoder().decode(result)
}

// --- State blob: all prompt-related state in one compressed param (s) ---

export type StateBlob = {
  prompt: string
  schemes: PromptScheme[]
  originalPrompt: string | null
}

const EMPTY_FIELDS: PromptScheme['fields'] = {
  mode: 'generate',
  subject: '', action: '', scene: '', composition: '', style: '',
  lighting: '', colorPalette: '', textInImage: '', constraints: '',
  editType: '', primaryRequest: '', referenceRole: '', targetScene: '', invariants: '',
}

const FIELD_KEYS = [
  'subject',
  'action',
  'scene',
  'composition',
  'style',
  'lighting',
  'colorPalette',
  'textInImage',
  'constraints',
  'editType',
  'primaryRequest',
  'referenceRole',
  'targetScene',
  'invariants',
] as const satisfies ReadonlyArray<Exclude<keyof PromptScheme['fields'], 'mode'>>

type CompactScheme = [
  title: string,
  description: string,
  mode: 0 | 1,
  fieldPairs: Array<number | string>,
]

type CompactStateBlob = [
  prompt: string,
  schemes: CompactScheme[],
  originalPrompt: string | null,
]

function toCompactScheme(scheme: PromptScheme): CompactScheme {
  const fieldPairs: Array<number | string> = []
  for (let i = 0; i < FIELD_KEYS.length; i += 1) {
    const key = FIELD_KEYS[i]
    const value = scheme.fields[key]
    if (value !== '') {
      fieldPairs.push(i, value)
    }
  }

  return [
    scheme.title,
    scheme.description,
    scheme.fields.mode === 'edit' ? 1 : 0,
    fieldPairs,
  ]
}

function fromCompactScheme(scheme: CompactScheme): PromptScheme {
  const [title, description, mode, fieldPairs] = scheme
  const fields: PromptScheme['fields'] = {
    ...EMPTY_FIELDS,
    mode: mode === 1 ? 'edit' : 'generate',
  }

  for (let i = 0; i < fieldPairs.length; i += 2) {
    const fieldIndex = fieldPairs[i]
    const fieldValue = fieldPairs[i + 1]
    if (typeof fieldIndex !== 'number' || typeof fieldValue !== 'string') {
      throw new Error('Invalid compact state blob')
    }
    const fieldKey = FIELD_KEYS[fieldIndex]
    if (!fieldKey) {
      throw new Error('Invalid compact state blob')
    }
    fields[fieldKey] = fieldValue
  }

  return { title, description, fields }
}

function isCompactStateBlob(value: unknown): value is CompactStateBlob {
  if (!Array.isArray(value) || value.length !== 3) {
    return false
  }

  const [prompt, schemes, originalPrompt] = value
  if (typeof prompt !== 'string' || !Array.isArray(schemes)) {
    return false
  }
  if (originalPrompt !== null && typeof originalPrompt !== 'string') {
    return false
  }

  for (const scheme of schemes) {
    if (!Array.isArray(scheme) || scheme.length !== 4) {
      return false
    }
    const [title, description, mode, fieldPairs] = scheme
    if (typeof title !== 'string' || typeof description !== 'string') {
      return false
    }
    if (mode !== 0 && mode !== 1) {
      return false
    }
    if (!Array.isArray(fieldPairs)) {
      return false
    }
  }

  return true
}

export async function compressStateBlob(data: StateBlob): Promise<string> {
  const compact: CompactStateBlob = [
    data.prompt,
    data.schemes.map(toCompactScheme),
    data.originalPrompt,
  ]
  return compress(JSON.stringify(compact))
}

export async function decompressStateBlob(b64url: string): Promise<StateBlob> {
  const json = await decompress(b64url)
  const raw = JSON.parse(json) as unknown

  if (!isCompactStateBlob(raw)) {
    throw new Error('Invalid state blob')
  }

  const [prompt, schemes, originalPrompt] = raw
  return {
    prompt,
    schemes: schemes.map(fromCompactScheme),
    originalPrompt,
  }
}

// --- Simple (non-compressed) URL params: model/resolution/ratio/batch ---

export type SimpleUrlParams = {
  modelId: string | null
  resolution: string | null
  aspectRatio: string | null
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
