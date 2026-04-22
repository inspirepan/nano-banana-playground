import type { Provider } from '../config/models'

export async function validateApiKey(
  provider: Provider,
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    if (provider === 'google') {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hi' }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
        },
      )
      const data = await res.json()
      if (!res.ok) return { valid: false, error: data.error?.message || `HTTP ${res.status}` }
      return { valid: true }
    }

    // OpenAI: a cheap idempotent GET that only requires a valid key.
    const res = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      return { valid: false, error: data?.error?.message || `HTTP ${res.status}` }
    }
    return { valid: true }
  } catch {
    return { valid: false, error: 'Network error' }
  }
}

const KEY_INVALID_PATTERNS = [
  'api key not valid',
  'api_key_invalid',
  'invalid api key',
  'incorrect api key',
  'permission denied',
  'unauthorized',
  '401',
  '403',
]

export function isKeyError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase()
  return KEY_INVALID_PATTERNS.some((p) => lower.includes(p))
}
