export type SansFontId = 'geist' | 'system-ui' | 'inter' | 'hanken-grotesk' | 'google-sans-flex' | 'onest'

type FontOption<T extends string> = {
  id: T
  name: string
  className: string
  cssFamily: string
  /** Omitted when the font is bundled / self-hosted instead of fetched from Google Fonts. */
  googleQuery?: string
  googleFallbackQueries?: string[]
}

const ROBOTO_MONO_GOOGLE_QUERY = 'Roboto Mono:wght@100..700'

export const SANS_FONTS: FontOption<SansFontId>[] = [
  {
    id: 'geist',
    name: 'Geist',
    className: 'font-sans-geist',
    cssFamily: "'Geist'",
  },
  {
    id: 'system-ui',
    name: 'System UI',
    className: 'font-sans-system-ui',
    cssFamily: 'system-ui',
  },
  {
    id: 'inter',
    name: 'Inter',
    className: 'font-sans-inter',
    cssFamily: "'Inter'",
    googleQuery: 'Inter:ital,wght@0,100..900;1,100..900',
  },
  {
    id: 'hanken-grotesk',
    name: 'Hanken Grotesk',
    className: 'font-sans-hanken-grotesk',
    cssFamily: "'Hanken Grotesk'",
    googleQuery: 'Hanken Grotesk:ital,wght@0,100..900;1,100..900',
  },
  {
    id: 'google-sans-flex',
    name: 'Google Sans Flex',
    className: 'font-sans-google-sans-flex',
    cssFamily: "'Google Sans Flex'",
    googleQuery: 'Google Sans Flex:opsz,slnt,wght@6..144,-10..0,1..1000',
  },
  {
    id: 'onest',
    name: 'Onest',
    className: 'font-sans-onest',
    cssFamily: "'Onest'",
    googleQuery: 'Onest:wght@100..900',
  },
]

export const SANS_FONT_IDS = SANS_FONTS.map((font) => font.id)

export const DEFAULT_SANS_FONT: SansFontId = 'hanken-grotesk'

function googleFontsHrefForQueries(queries: string[]) {
  const uniqueQueries = [...new Set(queries)]
  const families = uniqueQueries.map((query) => `family=${query.replaceAll(' ', '+')}`).join('&')
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

export function googleFontsHref(sansFont: SansFontId) {
  const sans = SANS_FONTS.find((font) => font.id === sansFont) ?? SANS_FONTS[0]
  const queries = [
    ...(sans.googleQuery ? [sans.googleQuery] : []),
    ...(sans.googleFallbackQueries ?? []),
    ROBOTO_MONO_GOOGLE_QUERY,
  ]
  return googleFontsHrefForQueries(queries)
}

export function googleFontPreviewsHref() {
  const queries = SANS_FONTS.flatMap((font) => [
    ...(font.googleQuery ? [font.googleQuery] : []),
    ...(font.googleFallbackQueries ?? []),
  ])
  return googleFontsHrefForQueries(queries)
}
