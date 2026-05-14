import { useMemo, useRef, useState, type ChangeEvent } from 'react'

import type { AgentSkillCreateInput } from '../../agent'
import { setShowAgentUsageStats } from '../../config/agentUsageStats'
import { setComposerSubmitMode, type ComposerSubmitMode } from '../../config/composerSubmitMode'
import { setStripDownloadMetadata } from '../../config/downloadMetadata'
import type { AgentThinkingLevel } from '../../config/agentModels'
import type { LanguagePreference } from '../../config/languages'
import type { Provider } from '../../config/models'
import type { Theme } from '../../config/theme'
import type { WebApiProvider, WebFetchProvider, WebSearchProvider } from '../../config/webProviders'
import type { StoredUserSkill } from '../../agent/skills/types'
import { useI18n } from '../../i18n'
import { Tooltip } from '../Tooltip'
import {
  buildSettingsImportPlan,
  createDefaultSettingsImportSelection,
  deselectSettingsImportItems,
  getSelectedSettingsImportItemsForApply,
  getSettingsImportItemIssue,
  isSettingsImportItemSelectable,
  createSettingsExportBundle,
  parseSettingsExportJson,
  selectSettingsImportItems,
  type PreferenceImportKey,
  type SettingsImportGroup,
  type SettingsImportItemStatus,
  type SettingsImportPlan,
  type SettingsImportPlanItem,
} from '../../lib/settingsBackup'
import {
  writeDetailSidebarCollapsedPreference,
  writePreferredAgentModelPreference,
  writePreferredAgentThinkingLevelPreference,
} from '../../lib/preferenceStore'
import { Icon } from '../Icon'
import type { KeyHook } from './ApiKeySettingsTab'
import { SettingsSection } from './SettingsSection'

type SettingsBackupTabProps = {
  keyHooks: Record<Provider, KeyHook>
  onThemeChange: (theme: Theme) => void
  onLanguageChange: (id: LanguagePreference) => void
  onGenerationConcurrencyChange: (value: number) => void
  onAgentPanelWidePreferenceChange: (wide: boolean) => void
  onAgentWideTipDismissedPreferenceChange: (dismissed: boolean) => void
  onWebSearchProviderChange: (provider: WebSearchProvider) => void
  onWebFetchProviderChange: (provider: WebFetchProvider) => void
  onImportWebProviderApiKey: (provider: WebApiProvider, apiKey: string) => void
  onAgentSkillEnabledChange: (name: string, enabled: boolean) => void
  onCreateAgentSkill: (input: AgentSkillCreateInput) => void
}

const GROUP_ORDER: SettingsImportGroup[] = [
  'appearance',
  'generation',
  'download',
  'agent',
  'serviceProviders',
  'webTools',
  'skills',
  'secrets',
]

export function SettingsBackupTab({
  keyHooks,
  onThemeChange,
  onLanguageChange,
  onGenerationConcurrencyChange,
  onAgentPanelWidePreferenceChange,
  onAgentWideTipDismissedPreferenceChange,
  onWebSearchProviderChange,
  onWebFetchProviderChange,
  onImportWebProviderApiKey,
  onAgentSkillEnabledChange,
  onCreateAgentSkill,
}: SettingsBackupTabProps) {
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [includeApiKeys, setIncludeApiKeys] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [plan, setPlan] = useState<SettingsImportPlan | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [importError, setImportError] = useState<string | null>(null)
  const [applyNotice, setApplyNotice] = useState<string | null>(null)

  const selectedCount = selectedIds.size
  const visiblePlanItems = useMemo(() => (plan?.items ?? []).filter((item) => item.status !== 'unchanged'), [plan])
  const groupedItems = useMemo(() => groupImportItems(visiblePlanItems), [visiblePlanItems])

  const loadImportText = (text: string) => {
    setImportError(null)
    setApplyNotice(null)
    try {
      const nextPlan = buildSettingsImportPlan(parseSettingsExportJson(text))
      setPlan(nextPlan)
      setSelectedIds(createDefaultSettingsImportSelection(nextPlan))
    } catch (error) {
      setPlan(null)
      setSelectedIds(new Set())
      setImportError(importErrorMessage(error, t))
    }
  }

  const handleExport = () => {
    const bundle = createSettingsExportBundle({ includeApiKeys })
    const blob = new Blob([`${JSON.stringify(bundle, null, 2)}\n`], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `settings-${new Date().toISOString().slice(0, 10)}.json`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    void file
      .text()
      .then(loadImportText)
      .catch(() => setImportError(t('settings.backup.error.readFile')))
  }

  const toggleItem = (id: string) => {
    if (!plan) return
    setSelectedIds((current) => {
      if (current.has(id)) return deselectSettingsImportItems(plan, current, [id])
      return selectSettingsImportItems(plan, current, [id])
    })
  }

  const toggleGroup = (items: SettingsImportPlanItem[]) => {
    if (!plan) return
    const selectableIds = items.filter(isSettingsImportItemSelectable).map((item) => item.id)
    if (selectableIds.length === 0) return
    setSelectedIds((current) => {
      const allSelected = selectableIds.every((id) => current.has(id))
      if (allSelected) return deselectSettingsImportItems(plan, current, selectableIds)
      return selectSettingsImportItems(plan, current, selectableIds)
    })
  }

  const setSelectableItems = (selected: boolean) => {
    if (!plan) return
    setSelectedIds(
      selected
        ? selectSettingsImportItems(
            plan,
            new Set(),
            plan.items.filter(isSettingsImportItemSelectable).map((item) => item.id),
          )
        : new Set(),
    )
  }

  const handleApply = () => {
    if (!plan || selectedIds.size === 0) return
    let applied = 0
    let failed = 0
    for (const item of getSelectedSettingsImportItemsForApply(plan, selectedIds)) {
      try {
        applyImportItem(item, {
          keyHooks,
          onThemeChange,
          onLanguageChange,
          onGenerationConcurrencyChange,
          onAgentPanelWidePreferenceChange,
          onAgentWideTipDismissedPreferenceChange,
          onWebSearchProviderChange,
          onWebFetchProviderChange,
          onImportWebProviderApiKey,
          onAgentSkillEnabledChange,
          onCreateAgentSkill,
        })
        applied++
      } catch {
        failed++
      }
    }
    setSelectedIds(new Set())
    setPlan(null)
    setApplyNotice(
      failed > 0
        ? t('settings.backup.importAppliedWithFailures', { count: applied, failed })
        : t('settings.backup.importApplied', { count: applied }),
    )
  }

  const exportedAt = plan
    ? Number.isNaN(Date.parse(plan.bundle.exportedAt))
      ? plan.bundle.exportedAt
      : new Date(plan.bundle.exportedAt).toLocaleString()
    : ''

  return (
    <div className="space-y-5 px-5 py-4">
      <SettingsSection label={t('settings.backup.export.title')} hint={t('settings.backup.export.description')}>
        <div className="overflow-hidden rounded-[var(--radius-md)] bg-(--color-surface) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
          <label className="flex items-start gap-2 px-3 py-2.5 text-sm text-(--color-text-2)">
            <input
              type="checkbox"
              checked={includeApiKeys}
              onChange={(event) => setIncludeApiKeys(event.currentTarget.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-(--color-text)">{t('settings.backup.export.includeApiKeys')}</span>
              <span className="mt-0.5 block text-(--color-text-3)">
                {t('settings.backup.export.includeApiKeysHint')}
              </span>
            </span>
          </label>
          <div className="flex px-3 py-2.5 shadow-[inset_0_1px_0_var(--ring-edge-soft)]">
            <button type="button" onClick={handleExport} className="chip">
              <Icon name="download" size={12} /> {t('settings.backup.export.download')}
            </button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection label={t('settings.backup.import.title')} hint={t('settings.backup.import.description')} divider>
        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleFileChange} hidden />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="chip">
            <Icon name="upload" size={12} /> {t('settings.backup.import.chooseFile')}
          </button>
          <button type="button" onClick={() => loadImportText(pasteText)} disabled={!pasteText.trim()} className="chip">
            {t('settings.backup.import.parsePaste')}
          </button>
        </div>
        <textarea
          value={pasteText}
          onChange={(event) => setPasteText(event.currentTarget.value)}
          placeholder={t('settings.backup.import.pastePlaceholder')}
          className="min-h-24 w-full resize-y rounded-[var(--radius-md)] bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) outline-none shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] transition-shadow focus:shadow-[inset_0_0_0_1px_var(--ring-edge-strong)]"
        />
        {importError && <p className="text-sm text-(--color-danger)">{importError}</p>}
        {applyNotice && (
          <p className="rounded-[var(--radius-md)] bg-(--color-accent-wash) px-3 py-2 text-sm text-(--color-text) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
            {applyNotice}
          </p>
        )}
      </SettingsSection>

      {plan && (
        <SettingsSection
          divider
          label={t('settings.backup.preview.title')}
          hint={t('settings.backup.preview.exportedAt', { date: exportedAt })}
          actions={
            <>
              <button type="button" onClick={() => setSelectableItems(true)} className="chip ghost">
                {t('settings.backup.preview.selectAll')}
              </button>
              <button type="button" onClick={() => setSelectableItems(false)} className="chip ghost">
                {t('settings.backup.preview.selectNone')}
              </button>
            </>
          }
        >
          <div className="grid overflow-hidden rounded-[var(--radius-md)] bg-(--color-surface) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] sm:grid-cols-3">
            <SummaryCell tone="selected" label={t('settings.backup.preview.selected', { count: selectedCount })} />
            <SummaryCell
              tone="changed"
              label={t('settings.backup.preview.overwrites', { count: plan.summary.changed })}
            />
            <SummaryCell tone="added" label={t('settings.backup.preview.additions', { count: plan.summary.added })} />
            {plan.summary.invalid > 0 && (
              <SummaryCell
                tone="invalid"
                label={t('settings.backup.preview.invalidItems', { count: plan.summary.invalid })}
              />
            )}
          </div>

          <div className="space-y-3">
            {GROUP_ORDER.flatMap((group) => {
              const items = groupedItems.get(group) ?? []
              if (items.length === 0) return []
              return [
                <ImportPlanGroup
                  key={group}
                  group={group}
                  items={items}
                  selectedIds={selectedIds}
                  onToggle={toggleItem}
                  onToggleGroup={toggleGroup}
                />,
              ]
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" onClick={handleApply} disabled={selectedCount === 0} className="chip">
              <Icon name="check" size={12} /> {t('settings.backup.import.applySelected', { count: selectedCount })}
            </button>
            <p className="text-sm text-(--color-text-3)">{t('settings.backup.import.applyHint')}</p>
          </div>
        </SettingsSection>
      )}
    </div>
  )
}

function SummaryCell({ tone, label }: { tone: SettingsImportItemStatus | 'selected'; label: string }) {
  const toneClass = {
    selected: 'text-(--color-accent)',
    changed: 'text-(--color-warning)',
    added: 'text-(--color-success)',
    invalid: 'text-(--color-danger)',
    unchanged: 'text-(--color-text-3)',
  }[tone]
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-sm text-(--color-text) shadow-[inset_-1px_0_0_var(--ring-edge-soft)] last:shadow-none">
      <span className={`flex size-4 items-center justify-center rounded-full bg-(--color-surface-2) ${toneClass}`}>
        {tone === 'added' ? (
          <Icon name="plus" size={11} />
        ) : (
          <Icon name={tone === 'invalid' ? 'alert_circle' : 'check'} size={11} />
        )}
      </span>
      <span className="font-medium tabular-nums">{label}</span>
    </div>
  )
}

function ImportPlanGroup({
  group,
  items,
  selectedIds,
  onToggle,
  onToggleGroup,
}: {
  group: SettingsImportGroup
  items: SettingsImportPlanItem[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleGroup: (items: SettingsImportPlanItem[]) => void
}) {
  const { t } = useI18n()
  const selectable = items.filter(isSettingsImportItemSelectable)
  const selectedInGroup = selectable.filter((item) => selectedIds.has(item.id)).length
  const groupChecked = selectable.length > 0 && selectedInGroup === selectable.length
  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] bg-(--color-surface) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
      <div className="grid min-w-0 grid-cols-[auto_minmax(120px,1fr)_auto_minmax(0,1.15fr)_auto_minmax(0,1.15fr)] items-center gap-3 px-3 py-2 shadow-[inset_0_-1px_0_var(--ring-edge-soft)]">
        <input
          type="checkbox"
          checked={groupChecked}
          disabled={selectable.length === 0}
          onChange={() => onToggleGroup(items)}
          className="shrink-0"
          aria-label={t(`settings.backup.group.${group}`)}
        />
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-semibold text-(--color-text-2)">{t(`settings.backup.group.${group}`)}</span>
          <span className="rounded-[var(--radius-xs)] bg-(--color-surface-2) px-1.5 py-0.5 text-xs tabular-nums text-(--color-text-3)">
            {items.length}
          </span>
        </div>
      </div>
      {items.map((item, index) => (
        <ImportPlanRow
          key={item.id}
          item={item}
          selected={selectedIds.has(item.id)}
          selectedIds={selectedIds}
          last={index === items.length - 1}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}

function ImportPlanRow({
  item,
  selected,
  selectedIds,
  last,
  onToggle,
}: {
  item: SettingsImportPlanItem
  selected: boolean
  selectedIds: Set<string>
  last: boolean
  onToggle: (id: string) => void
}) {
  const { t } = useI18n()
  const disabled = !isSettingsImportItemSelectable(item)
  const issue = getSettingsImportItemIssue(item, selectedIds)
  return (
    <label
      className={`grid min-w-0 grid-cols-[auto_minmax(120px,1fr)_auto_minmax(0,1.15fr)_auto_minmax(0,1.15fr)] items-center gap-3 px-3 py-2 ${last ? '' : 'shadow-[inset_0_-1px_0_var(--ring-edge-soft)]'} ${
        disabled ? 'opacity-65' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={disabled}
        onChange={() => onToggle(item.id)}
        className="shrink-0"
      />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-(--color-text)">{t(item.labelKey, item.labelParams)}</div>
        {issue && (
          <div className="truncate text-xs text-(--color-danger)">{t(issue.reasonKey, issue.reasonParams)}</div>
        )}
      </div>
      <StatusPill status={item.status} sensitive={item.sensitive} />
      <Tooltip text={displayValue(item.currentValueLabel, t)} placement="top" maxWidth={360} className="min-w-0">
        <span className="mono block truncate text-sm text-(--color-text-3)">
          {displayValue(item.currentValueLabel, t)}
        </span>
      </Tooltip>
      <span className="text-center text-sm text-(--color-text-4)">→</span>
      <Tooltip text={displayValue(item.incomingValueLabel, t)} placement="top" maxWidth={360} className="min-w-0">
        <span className="mono block truncate text-sm font-medium text-(--color-text)">
          {displayValue(item.incomingValueLabel, t)}
        </span>
      </Tooltip>
    </label>
  )
}

function StatusPill({ status, sensitive }: { status: SettingsImportItemStatus; sensitive?: boolean }) {
  const { t } = useI18n()
  const color =
    status === 'added' ? 'var(--color-success)' : status === 'invalid' ? 'var(--color-danger)' : 'var(--color-warning)'
  return (
    <Tooltip
      text={sensitive ? t('settings.backup.sensitive') : t(`settings.backup.status.${status}`)}
      placement="top"
      className="w-fit"
    >
      <span
        className="block rounded-[var(--radius-xs)] px-1.5 py-0.5 text-xs font-medium"
        style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
      >
        {t(`settings.backup.status.${status}`)}
      </span>
    </Tooltip>
  )
}

function groupImportItems(items: SettingsImportPlanItem[]): Map<SettingsImportGroup, SettingsImportPlanItem[]> {
  const groups = new Map<SettingsImportGroup, SettingsImportPlanItem[]>()
  for (const item of items) {
    const groupItems = groups.get(item.group) ?? []
    groupItems.push(item)
    groups.set(item.group, groupItems)
  }
  return groups
}

function displayValue(value: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (value === '—') return t('settings.backup.value.empty')
  if (value === 'on') return t('settings.backup.value.on')
  if (value === 'off') return t('settings.backup.value.off')
  return value
}

function importErrorMessage(
  error: unknown,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (error instanceof Error) {
    if (error.message === 'invalid-json') return t('settings.backup.error.invalidJson')
    if (error.message === 'unsupported-settings-export') return t('settings.backup.error.unsupported')
    if (error.message === 'invalid-settings-export') return t('settings.backup.error.invalidShape')
  }
  return t('settings.backup.error.invalidShape')
}

type ApplyContext = SettingsBackupTabProps

function applyImportItem(item: SettingsImportPlanItem, context: ApplyContext): void {
  switch (item.kind) {
    case 'preference':
      applyPreference(item.payload as { key: PreferenceImportKey; value: string | number | boolean }, context)
      return
    case 'serviceProviderBaseUrl': {
      const payload = item.payload as { provider: Provider; value: string }
      context.keyHooks[payload.provider].importCredentials(undefined, payload.value, null)
      return
    }
    case 'serviceProviderUseProxy': {
      const payload = item.payload as { provider: Provider; value: boolean }
      context.keyHooks[payload.provider].importCredentials(undefined, undefined, payload.value)
      return
    }
    case 'webProvider': {
      const payload = item.payload as
        | { key: 'searchProvider'; value: WebSearchProvider }
        | { key: 'fetchProvider'; value: WebFetchProvider }
      if (payload.key === 'searchProvider') context.onWebSearchProviderChange(payload.value)
      else context.onWebFetchProviderChange(payload.value)
      return
    }
    case 'userSkill': {
      const payload = item.payload as { skill: StoredUserSkill }
      const skill = payload.skill
      const description = skill.agentDescription?.trim() || `Use this skill for ${skill.name} in this app.`
      context.onCreateAgentSkill({
        name: skill.name,
        agentDescription: description,
        displayName: skill.displayName,
        displayDescription: {
          'zh-CN': skill.displayDescription?.['zh-CN'] || skill.displayDescription?.en || description,
          en: skill.displayDescription?.en || skill.displayDescription?.['zh-CN'] || description,
        },
        icon: skill.icon ?? 'wand',
        files: skill.files,
        enabled: skill.enabled,
      })
      return
    }
    case 'skillEnabled': {
      const payload = item.payload as { skillName: string; enabled: boolean }
      context.onAgentSkillEnabledChange(payload.skillName, payload.enabled)
      return
    }
    case 'providerApiKey': {
      const payload = item.payload as { provider: Provider; apiKey: string }
      context.keyHooks[payload.provider].importCredentials(payload.apiKey, undefined, null)
      return
    }
    case 'webApiKey': {
      const payload = item.payload as { provider: WebApiProvider; apiKey: string }
      context.onImportWebProviderApiKey(payload.provider, payload.apiKey)
      return
    }
  }
}

function applyPreference(
  payload: { key: PreferenceImportKey; value: string | number | boolean },
  context: ApplyContext,
): void {
  switch (payload.key) {
    case 'theme':
      context.onThemeChange(payload.value as Theme)
      return
    case 'language':
      context.onLanguageChange(payload.value as LanguagePreference)
      return
    case 'generationConcurrency':
      context.onGenerationConcurrencyChange(Number(payload.value))
      return
    case 'detailSidebarCollapsed':
      writeDetailSidebarCollapsedPreference(Boolean(payload.value))
      return
    case 'agentPanelWide':
      context.onAgentPanelWidePreferenceChange(Boolean(payload.value))
      return
    case 'agentWideTipDismissed':
      context.onAgentWideTipDismissedPreferenceChange(Boolean(payload.value))
      return
    case 'preferredAgentModel':
      writePreferredAgentModelPreference(String(payload.value))
      return
    case 'preferredAgentThinkingLevel':
      writePreferredAgentThinkingLevelPreference(payload.value as AgentThinkingLevel)
      return
    case 'composerSubmitMode':
      setComposerSubmitMode(payload.value as ComposerSubmitMode)
      return
    case 'showAgentUsageStats':
      setShowAgentUsageStats(Boolean(payload.value))
      return
    case 'stripDownloadMetadata':
      setStripDownloadMetadata(Boolean(payload.value))
      return
  }
}
