// Shared type for the style preset registry. Each file under this directory
// owns one "skill family" — a group of preset chips sharing a category.

export type StylePreset = {
  id: string              // stable identifier; used in URL state, do not rename existing ones
  label: string           // short chip text (2-4 Chinese characters preferred)
  category?: string       // group header in the chip picker
  description?: string    // one-line blurb for chip tooltip / manage dialog
  promptSnippet: string   // Chinese style paragraph appended to augment prompt
}
