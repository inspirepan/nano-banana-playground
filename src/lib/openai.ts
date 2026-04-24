// OpenAI (gpt-image-2) specific helpers: size lookup + token/cost estimate.

// (aspectRatio, resolution) -> WxH string accepted by the API.
// All values satisfy gpt-image-2 constraints: both edges divisible by 16,
// long:short ratio <= 3:1, long edge <= 3840, pixel count within
// [655,360, 8,294,400].
export const OPENAI_SIZE_TABLE: Record<string, Record<string, string>> = {
  '1:1': { '1K': '1024x1024', '2K': '2048x2048', '4K': '2880x2880' },
  '3:2': { '1K': '1536x1024', '2K': '2400x1600', '4K': '3456x2304' },
  '2:3': { '1K': '1024x1536', '2K': '1600x2400', '4K': '2304x3456' },
  '4:3': { '1K': '1152x864', '2K': '2048x1536', '4K': '3264x2448' },
  '3:4': { '1K': '864x1152', '2K': '1536x2048', '4K': '2448x3264' },
  '5:4': { '1K': '1120x896', '2K': '2240x1792', '4K': '3200x2560' },
  '4:5': { '1K': '896x1120', '2K': '1792x2240', '4K': '2560x3200' },
  '16:9': { '1K': '1280x720', '2K': '2048x1152', '4K': '3840x2160' },
  '9:16': { '1K': '720x1280', '2K': '1152x2048', '4K': '2160x3840' },
  '21:9': { '1K': '1344x576', '2K': '2016x864', '4K': '3808x1632' },
  '3:1': { '1K': '1536x512', '2K': '2400x800', '4K': '3840x1280' },
  '1:3': { '1K': '512x1536', '2K': '800x2400', '4K': '1280x3840' },
}

export function openAISize(resolution: string, aspectRatio: string): string {
  return OPENAI_SIZE_TABLE[aspectRatio]?.[resolution] ?? '1024x1024'
}

const GPT_IMAGE_2_OUTPUT_TOKENS_BASE: Record<'low' | 'medium' | 'high', number> = {
  low: 16,
  medium: 48,
  high: 96,
}

const OPENAI_MAX_EDGE = 3840
const OPENAI_MIN_PIXELS = 655_360
const OPENAI_MAX_PIXELS = 8_294_400
const OPENAI_MAX_ASPECT_RATIO = 3
const OPENAI_IMAGE_OUTPUT_PRICE_PER_MILLION = 30

function parseSize(size: string): { width: number; height: number } | null {
  const match = /^(\d+)x(\d+)$/.exec(size)
  if (!match) return null

  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return null
  }

  return { width, height }
}

function isValidOpenAIImageSize(width: number, height: number): boolean {
  if (width % 16 !== 0 || height % 16 !== 0) return false

  const pixels = width * height
  if (pixels < OPENAI_MIN_PIXELS || pixels > OPENAI_MAX_PIXELS) return false

  const longEdge = Math.max(width, height)
  const shortEdge = Math.min(width, height)
  if (longEdge > OPENAI_MAX_EDGE) return false
  if (longEdge / shortEdge > OPENAI_MAX_ASPECT_RATIO) return false

  return true
}

// OpenAI's gpt-image-2 docs expose a calculator that estimates output tokens
// directly from size + quality. We mirror that formula here so the UI can
// estimate pre-generation cost for any valid size, not just a small lookup set.
export function gptImage2OutputTokens(size: string, quality: string): number | null {
  const parsed = parseSize(size)
  if (!parsed) return null

  const { width, height } = parsed
  if (!isValidOpenAIImageSize(width, height)) return null

  const resolvedQuality = quality === 'auto' ? 'medium' : quality
  if (!(resolvedQuality in GPT_IMAGE_2_OUTPUT_TOKENS_BASE)) return null

  const longestEdge = Math.max(width, height)
  const shortestEdge = Math.min(width, height)
  const primary = GPT_IMAGE_2_OUTPUT_TOKENS_BASE[resolvedQuality as keyof typeof GPT_IMAGE_2_OUTPUT_TOKENS_BASE]
  const secondary = Math.round((primary * shortestEdge) / longestEdge)
  const widthFactor = width >= height ? primary : secondary
  const heightFactor = width >= height ? secondary : primary
  const tileCount = widthFactor * heightFactor

  return Math.ceil((tileCount * (2_000_000 + width * height)) / 4_000_000)
}

export function gptImage2PricePerImage(size: string, quality: string): number | null {
  const outputTokens = gptImage2OutputTokens(size, quality)
  if (outputTokens === null) return null
  return (outputTokens * OPENAI_IMAGE_OUTPUT_PRICE_PER_MILLION) / 1_000_000
}
