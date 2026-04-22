// Aggregates all builtin style presets. Each file in this directory owns one
// "skill family" (one category in the chip picker). To add a new family:
// 1. Create a new file exporting a StylePreset[].
// 2. Import and spread it into BUILTIN_STYLE_PRESETS below.
//
// Preset ordering here determines the order chips appear in the picker (after
// the free-play chip). Categories group automatically by the `category` field.

import type { StylePreset } from './types'
import { EDITORIAL_SKETCH_PRESETS } from './editorial-sketch'
import { COVER_IMAGE_PRESETS } from './baoyu-cover-image'
import { INFOGRAPHIC_PRESETS } from './baoyu-infographic'
import { DIAGRAM_PRESETS } from './baoyu-diagram'
import { COMIC_PRESETS } from './baoyu-comic'
import { XHS_IMAGES_PRESETS } from './baoyu-xhs-images'

export type { StylePreset }

export const BUILTIN_STYLE_PRESETS: StylePreset[] = [
  ...EDITORIAL_SKETCH_PRESETS,
  ...COVER_IMAGE_PRESETS,
  ...INFOGRAPHIC_PRESETS,
  ...DIAGRAM_PRESETS,
  ...COMIC_PRESETS,
  ...XHS_IMAGES_PRESETS,
]
