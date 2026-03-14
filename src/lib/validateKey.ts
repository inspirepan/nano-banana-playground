export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
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

    if (!res.ok) {
      return { valid: false, error: data.error?.message || `HTTP ${res.status}` }
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
  'permission denied',
  'unauthorized',
  '401',
  '403',
]

export function isKeyError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase()
  return KEY_INVALID_PATTERNS.some((p) => lower.includes(p))
}
