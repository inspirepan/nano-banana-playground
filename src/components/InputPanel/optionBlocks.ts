import type { ModelConfig, ModelOption, ModelToggleOption } from '../../config/models'

export type OptionsBlock =
  | { kind: 'single'; option: ModelOption }
  | { kind: 'toggles'; label: string; hint?: string; options: ModelToggleOption[] }

// Group adjacent toggle options sharing a `group` into one visual section.
export function buildOptionBlocks(opts: ModelOption[]): OptionsBlock[] {
  const blocks: OptionsBlock[] = []
  let i = 0
  while (i < opts.length) {
    const head = opts[i]
    if (head.type === 'toggle' && head.group) {
      const group: ModelToggleOption[] = [head]
      let j = i + 1
      while (j < opts.length) {
        const next = opts[j]
        if (next.type !== 'toggle' || next.group !== head.group) break
        group.push(next)
        j++
      }
      blocks.push({
        kind: 'toggles',
        label: head.groupLabel ?? head.label,
        hint: head.hint,
        options: group,
      })
      i = j
    } else {
      blocks.push({ kind: 'single', option: head })
      i++
    }
  }
  return blocks
}

export function getOptionSummaryLabels(model: ModelConfig, values: Record<string, unknown>) {
  const labels: string[] = []

  for (const option of model.options ?? []) {
    const value = values[option.id]
    if (value === option.default) continue

    if (option.type === 'toggle') {
      if (value === true) labels.push(option.label)
      continue
    }

    if (typeof value !== 'string') continue
    const choice = option.choices.find((item) => item.value === value)
    if (!choice || choice.value === option.default) continue
    labels.push(`${option.label} ${choice.label}`)
  }

  return labels
}
