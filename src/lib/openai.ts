// OpenAI (gpt-image-2) specific helpers: size lookup + per-image pricing.

// (aspectRatio, resolution) -> WxH string accepted by the API.
// All values satisfy gpt-image-2 constraints: both edges divisible by 16,
// long:short ratio <= 3:1, pixel count within [655,360, 8,294,400].
export const OPENAI_SIZE_TABLE: Record<string, Record<string, string>> = {
  '1:1':  { '1K': '1024x1024', '2K': '2048x2048', '4K': '2880x2880' },
  '3:2':  { '1K': '1536x1024', '2K': '2400x1600', '4K': '3456x2304' },
  '2:3':  { '1K': '1024x1536', '2K': '1600x2400', '4K': '2304x3456' },
  '16:9': { '1K': '1280x720',  '2K': '2048x1152', '4K': '3840x2160' },
}

export function openAISize(resolution: string, aspectRatio: string): string {
  return OPENAI_SIZE_TABLE[aspectRatio]?.[resolution] ?? '1024x1024'
}

// Official per-image prices (USD) for gpt-image-2 at the sizes OpenAI publishes.
// Larger sizes (2K/4K tier) are not in the official price table; we return
// null for those and the UI hides the estimate.
// Source: https://platform.openai.com/docs/guides/image-generation
const GPT_IMAGE_2_PRICE: Record<string, Record<string, number>> = {
  '1024x1024': { low: 0.006, medium: 0.053, high: 0.211 },
  '1024x1536': { low: 0.005, medium: 0.041, high: 0.165 },
  '1536x1024': { low: 0.005, medium: 0.041, high: 0.165 },
}

export function gptImage2PricePerImage(size: string, quality: string): number | null {
  // "auto" -> estimate using medium as a proxy (what the model commonly picks).
  const q = quality === 'auto' ? 'medium' : quality
  return GPT_IMAGE_2_PRICE[size]?.[q] ?? null
}
