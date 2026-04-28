// Brush sizes are in source-image natural pixels.
export const BRUSH_PRESETS = [
  { id: 'S', label: '细', size: 24, dot: 6 },
  { id: 'M', label: '中', size: 56, dot: 9 },
  { id: 'L', label: '粗', size: 96, dot: 12 },
] as const

export type BrushPresetId = (typeof BRUSH_PRESETS)[number]['id']