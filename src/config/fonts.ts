export type SansFontId =
  | 'geist'
  | 'inter'
  | 'roboto'
  | 'space-grotesk'
  | 'google-sans-flex'
  | 'dm-sans'
  | 'ibm-plex-sans'
  | 'outfit'
  | 'onest'
  | 'source-serif-4'
  | 'newsreader'
  | 'literata'
  | 'bitter'
  | 'crimson-pro'
  | 'gelasio'

type FontOption<T extends string> = {
  id: T
  name: string
  className: string
  cssFamily: string
  googleQuery: string
  googleFallbackQueries?: string[]
}

const CJK_SERIF_FAMILY = "'Noto Serif SC', 'Songti SC', 'STSong', 'SimSun', serif"
const CJK_SERIF_GOOGLE_QUERY = 'Noto Serif SC:wght@200..900'
const ROBOTO_MONO_GOOGLE_QUERY = 'Roboto Mono:wght@100..700'

export const SANS_FONTS: FontOption<SansFontId>[] = [
  {
    id: 'geist',
    name: 'Geist',
    className: 'font-sans-geist',
    cssFamily: "'Geist'",
    googleQuery: 'Geist:wght@100..900',
  },
  {
    id: 'inter',
    name: 'Inter',
    className: 'font-sans-inter',
    cssFamily: "'Inter'",
    googleQuery: 'Inter:wght@100..900',
  },
  {
    id: 'roboto',
    name: 'Roboto',
    className: 'font-sans-roboto',
    cssFamily: "'Roboto'",
    googleQuery: 'Roboto:wght@100..900',
  },
  {
    id: 'space-grotesk',
    name: 'Space Grotesk',
    className: 'font-sans-space-grotesk',
    cssFamily: "'Space Grotesk'",
    googleQuery: 'Space Grotesk:wght@300..700',
  },
  {
    id: 'google-sans-flex',
    name: 'Google Sans Flex',
    className: 'font-sans-google-sans-flex',
    cssFamily: "'Google Sans Flex'",
    googleQuery: 'Google Sans Flex:opsz,wght@6..144,1..1000',
  },
  {
    id: 'dm-sans',
    name: 'DM Sans',
    className: 'font-sans-dm-sans',
    cssFamily: "'DM Sans'",
    googleQuery: 'DM Sans:opsz,wght@9..40,100..1000',
  },
  {
    id: 'ibm-plex-sans',
    name: 'IBM Plex Sans',
    className: 'font-sans-ibm-plex-sans',
    cssFamily: "'IBM Plex Sans'",
    googleQuery: 'IBM Plex Sans:wght@100;200;300;400;500;600;700',
  },
  {
    id: 'outfit',
    name: 'Outfit',
    className: 'font-sans-outfit',
    cssFamily: "'Outfit'",
    googleQuery: 'Outfit:wght@100..900',
  },
  {
    id: 'onest',
    name: 'Onest',
    className: 'font-sans-onest',
    cssFamily: "'Onest'",
    googleQuery: 'Onest:wght@100..900',
  },
  {
    id: 'source-serif-4',
    name: 'Source Serif 4',
    className: 'font-sans-source-serif-4',
    cssFamily: `'Source Serif 4', ${CJK_SERIF_FAMILY}`,
    googleQuery: 'Source Serif 4:opsz,wght@8..60,200..900',
    googleFallbackQueries: [CJK_SERIF_GOOGLE_QUERY],
  },
  {
    id: 'newsreader',
    name: 'Newsreader',
    className: 'font-sans-newsreader',
    cssFamily: `'Newsreader', ${CJK_SERIF_FAMILY}`,
    googleQuery: 'Newsreader:opsz,wght@6..72,200..800',
    googleFallbackQueries: [CJK_SERIF_GOOGLE_QUERY],
  },
  {
    id: 'literata',
    name: 'Literata',
    className: 'font-sans-literata',
    cssFamily: `'Literata', ${CJK_SERIF_FAMILY}`,
    googleQuery: 'Literata:opsz,wght@7..72,200..900',
    googleFallbackQueries: [CJK_SERIF_GOOGLE_QUERY],
  },
  {
    id: 'bitter',
    name: 'Bitter',
    className: 'font-sans-bitter',
    cssFamily: `'Bitter', ${CJK_SERIF_FAMILY}`,
    googleQuery: 'Bitter:wght@100..900',
    googleFallbackQueries: [CJK_SERIF_GOOGLE_QUERY],
  },
  {
    id: 'crimson-pro',
    name: 'Crimson Pro',
    className: 'font-sans-crimson-pro',
    cssFamily: `'Crimson Pro', ${CJK_SERIF_FAMILY}`,
    googleQuery: 'Crimson Pro:wght@200..900',
    googleFallbackQueries: [CJK_SERIF_GOOGLE_QUERY],
  },
  {
    id: 'gelasio',
    name: 'Gelasio',
    className: 'font-sans-gelasio',
    cssFamily: `'Gelasio', ${CJK_SERIF_FAMILY}`,
    googleQuery: 'Gelasio:wght@400..700',
    googleFallbackQueries: [CJK_SERIF_GOOGLE_QUERY],
  },
]

export const SANS_FONT_IDS = SANS_FONTS.map((font) => font.id)

export const DEFAULT_SANS_FONT: SansFontId = 'geist'

function googleFontsHrefForQueries(queries: string[]) {
  const uniqueQueries = [...new Set(queries)]
  const families = uniqueQueries.map((query) => `family=${query.replaceAll(' ', '+')}`).join('&')
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

export function googleFontsHref(sansFont: SansFontId) {
  const sans = SANS_FONTS.find((font) => font.id === sansFont) ?? SANS_FONTS[0]
  return googleFontsHrefForQueries([sans.googleQuery, ...(sans.googleFallbackQueries ?? []), ROBOTO_MONO_GOOGLE_QUERY])
}

export function googleFontPreviewsHref() {
  const queries = SANS_FONTS.flatMap((font) => [font.googleQuery, ...(font.googleFallbackQueries ?? [])])
  return googleFontsHrefForQueries(queries)
}
