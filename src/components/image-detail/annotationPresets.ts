// Brush sizes are in source-image natural pixels.
export const BRUSH_PRESETS = [
  { id: 'S', labelKey: 'imageDetail.annotation.brushSize.small', size: 24, dot: 6 },
  { id: 'M', labelKey: 'imageDetail.annotation.brushSize.medium', size: 56, dot: 9 },
  { id: 'L', labelKey: 'imageDetail.annotation.brushSize.large', size: 96, dot: 12 },
] as const

export type BrushPresetId = (typeof BRUSH_PRESETS)[number]['id']
