import { lazy, Suspense, useRef, useState } from 'react'

import { Icon } from './Icon'
import { SkillIcon } from './SkillIcon'
import {
  displayDescriptionForLanguage,
  displayNameForLanguage,
  type AgentSkill,
  type AgentSkillCreateInput,
  type AgentSkillFile,
  type AgentSkillSummary,
} from '../agent'
import { useMountEffect } from '../hooks/effects'
import { useI18n } from '../i18n'

const IconPicker = lazy(() => import('./IconPicker').then((module) => ({ default: module.IconPicker })))

type Props = {
  skills: AgentSkillSummary[]
  onEnabledChange: (name: string, enabled: boolean) => void
  onDelete: (name: string) => void
  onGetPackage: (name: string) => AgentSkill | null
  onCreate: (input: AgentSkillCreateInput) => void
}

export function AgentSkillSettings({ skills, onEnabledChange, onDelete, onGetPackage, onCreate }: Props) {
  const { t, language } = useI18n()
  const [createOpen, setCreateOpen] = useState(false)
  const [inspectedSkill, setInspectedSkill] = useState<AgentSkill | null>(null)
  const [selectedPath, setSelectedPath] = useState('SKILL.md')

  const openPackage = (name: string) => {
    const skill = onGetPackage(name)
    setInspectedSkill(skill)
    setSelectedPath(skill?.files[0]?.path ?? 'SKILL.md')
  }

  const selectedFile =
    inspectedSkill?.files.find((file) => file.path === selectedPath) ?? inspectedSkill?.files[0] ?? null

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" className="chip" onClick={() => setCreateOpen((open) => !open)}>
          <Icon name="plus" size={12} /> {t('settings.agentSkills.create')}
        </button>
      </div>

      {createOpen && (
        <AgentSkillCreateForm
          onCreate={onCreate}
          onClose={() => {
            setCreateOpen(false)
          }}
        />
      )}

      {skills.length === 0 ? (
        <div className="text-sm text-(--color-text-3)">{t('settings.agentSkills.empty')}</div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-md)] bg-(--color-surface) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
          {skills.map((skill, index) => {
            const displayName = displayNameForLanguage(skill, language)
            const hasDisplayName = displayName !== skill.name
            const description = displayDescriptionForLanguage(skill, language)
            const isLast = index === skills.length - 1
            const isInspected = inspectedSkill?.name === skill.name
            return (
              <div
                key={skill.name}
                role="button"
                tabIndex={0}
                aria-label={t('settings.agentSkills.viewPackage')}
                aria-pressed={isInspected}
                data-active={isInspected || undefined}
                onClick={() => openPackage(skill.name)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openPackage(skill.name)
                  }
                }}
                className={`cursor-pointer px-3.5 py-3 transition-colors hover:bg-(--color-surface-2) data-[active]:bg-(--color-accent-wash) ${isLast ? '' : 'shadow-[inset_0_-1px_0_var(--ring-edge-soft)]'}`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center text-(--color-text-3)"
                  >
                    <SkillIcon name={skill.icon} size={16} strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      {hasDisplayName ? (
                        <>
                          <span className="truncate text-sm font-medium text-(--color-text)">{displayName}</span>
                          <span className="mono truncate text-[11px] text-(--color-text-4)">{skill.name}</span>
                        </>
                      ) : (
                        <span className="mono truncate text-sm font-medium text-(--color-text)">{skill.name}</span>
                      )}
                      <span className="rounded-[var(--radius-xs)] bg-(--color-surface-2) px-1.5 py-0.5 text-[11px] font-medium text-(--color-text-3) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
                        {t(`settings.agentSkills.source.${skill.source}`)}
                      </span>
                      <span className="text-xs tabular-nums text-(--color-text-4)">
                        {t('settings.agentSkills.fileCount', { count: skill.fileCount })}
                      </span>
                    </div>
                    <div className="mt-1 text-sm leading-relaxed text-(--color-text-3)">{description}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={skill.enabled}
                      aria-label={
                        skill.enabled ? t('settings.agentSkills.enabled') : t('settings.agentSkills.disabled')
                      }
                      onClick={(event) => {
                        event.stopPropagation()
                        onEnabledChange(skill.name, !skill.enabled)
                      }}
                      className="group inline-flex items-center rounded-[var(--radius-sm)] p-1 transition-colors hover:bg-(--color-surface-2)"
                    >
                      <span
                        className={`relative h-4 w-7 rounded-full transition-colors ${
                          skill.enabled ? 'bg-(--color-accent)' : 'bg-(--color-surface-2)'
                        }`}
                        style={{ boxShadow: 'inset 0 0 0 1px var(--ring-edge-soft)' }}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-(--switch-thumb-bg) transition-transform ${
                            skill.enabled ? 'translate-x-3' : 'translate-x-0'
                          }`}
                          style={{ boxShadow: '0 0 0 1px var(--ring-edge-soft)' }}
                        />
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onDelete(skill.name)
                        if (inspectedSkill?.name === skill.name) setInspectedSkill(null)
                      }}
                      disabled={skill.source !== 'user'}
                      className="icon-btn"
                      title={
                        skill.source === 'user'
                          ? t('settings.agentSkills.delete')
                          : t('settings.agentSkills.deleteUnavailable')
                      }
                      aria-label={
                        skill.source === 'user'
                          ? t('settings.agentSkills.delete')
                          : t('settings.agentSkills.deleteUnavailable')
                      }
                    >
                      {skill.source === 'user' ? <Icon name="trash" size={12} /> : <Icon name="lock" size={12} />}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {inspectedSkill && selectedFile && (
        <SkillPackageViewer
          key={inspectedSkill.name}
          skill={inspectedSkill}
          selectedPath={selectedFile.path}
          onSelectPath={setSelectedPath}
          onClose={() => setInspectedSkill(null)}
        />
      )}
    </div>
  )
}

type DraftSkillFile = AgentSkillFile & { id: string }

let draftSkillFileId = 0

function createDraftSkillFile(path: string, content: string): DraftSkillFile {
  draftSkillFileId += 1
  return { id: `skill-file-${draftSkillFileId}`, path, content }
}

function stripFrontmatter(markdown: string): string {
  const normalized = markdown.replace(/^\uFEFF/, '')
  if (!normalized.startsWith('---\n')) return normalized.trim()
  const end = normalized.indexOf('\n---', 4)
  if (end === -1) return normalized.trim()
  return normalized
    .slice(end)
    .replace(/^\n---\s*\n?/, '')
    .trim()
}

function yamlSingleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function buildRootSkillMarkdown(
  name: string,
  description: string,
  icon: string,
  displayName: string,
  displayDescription: string,
  content: string,
): string {
  const body = stripFrontmatter(content) || `# ${name}\n\n${description}`
  const lines = [
    '---',
    `name: ${name}`,
    `description: ${yamlSingleLine(description)}`,
    `icon: ${icon.trim() || 'sparkles'}`,
  ]
  if (displayName.trim()) {
    lines.push('display_name:', `  zh-CN: ${yamlSingleLine(displayName)}`, `  en: ${yamlSingleLine(displayName)}`)
  }
  lines.push(
    'display_description:',
    `  zh-CN: ${yamlSingleLine(displayDescription || description)}`,
    `  en: ${yamlSingleLine(displayDescription || description)}`,
    '---',
  )
  return `${lines.join('\n')}\n\n${body}`
}

function AgentSkillCreateForm({
  onCreate,
  onClose,
}: {
  onCreate: (input: AgentSkillCreateInput) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('sparkles')
  const [displayName, setDisplayName] = useState('')
  const [agentDescription, setAgentDescription] = useState('')
  const [displayDescription, setDisplayDescription] = useState('')
  const [files, setFiles] = useState<DraftSkillFile[]>([
    createDraftSkillFile('SKILL.md', '# Skill instructions\n\nDescribe when and how the agent should use this skill.'),
  ])
  const [error, setError] = useState<string | null>(null)

  const updateFile = (id: string, patch: Partial<AgentSkillFile>) => {
    setFiles((prev) => prev.map((file) => (file.id === id ? { ...file, ...patch } : file)))
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id))
  }

  const addFile = () => {
    setFiles((prev) => [...prev, createDraftSkillFile('references/notes.md', '# Notes\n\n')])
  }

  const handleSubmit = () => {
    setError(null)
    const trimmedName = name.trim()
    const trimmedDescription = agentDescription.trim()
    const rootDraft = files.find((file) => file.path.trim() === 'SKILL.md')
    const rootMarkdown = buildRootSkillMarkdown(
      trimmedName || 'new-skill',
      trimmedDescription,
      icon,
      displayName.trim(),
      displayDescription.trim(),
      rootDraft?.content ?? '',
    )
    const nextFiles = files.map((file) =>
      file.path.trim() === 'SKILL.md'
        ? { path: 'SKILL.md', content: rootMarkdown }
        : { path: file.path, content: file.content },
    )
    if (!nextFiles.some((file) => file.path.trim() === 'SKILL.md')) {
      nextFiles.unshift({ path: 'SKILL.md', content: rootMarkdown })
    }
    const trimmedDisplay = displayDescription.trim() || trimmedDescription
    try {
      onCreate({
        name: trimmedName,
        agentDescription: trimmedDescription,
        displayName: displayName.trim()
          ? {
              'zh-CN': displayName.trim(),
              en: displayName.trim(),
            }
          : {},
        displayDescription: {
          'zh-CN': trimmedDisplay,
          en: trimmedDisplay,
        },
        icon: icon.trim() || 'sparkles',
        files: nextFiles,
        enabled: true,
      })
      onClose()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('settings.agentSkills.createFailed'))
    }
  }

  return (
    <div className="rounded-[var(--radius-md)] p-4 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
      <div className="mb-3">
        <div className="text-sm font-semibold text-(--color-text)">{t('settings.agentSkills.createTitle')}</div>
        <div className="mt-0.5 text-sm text-(--color-text-3)">{t('settings.agentSkills.createDescription')}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <TextField label={t('settings.agentSkills.name')} value={name} onChange={setName} placeholder="my-skill" />
        <label className="block">
          <span className="label mb-1 block px-1">{t('settings.agentSkills.icon')}</span>
          <Suspense
            fallback={
              <div className="rounded-[var(--radius-sm)] bg-(--color-surface-2) px-2.5 py-2 text-xs text-(--color-text-4) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
                {icon || 'sparkles'}
              </div>
            }
          >
            <IconPicker value={icon} onChange={setIcon} />
          </Suspense>
        </label>
      </div>
      <div className="mt-3">
        <TextField
          label={t('settings.agentSkills.displayName')}
          value={displayName}
          onChange={setDisplayName}
          placeholder={t('settings.agentSkills.displayNamePlaceholder')}
        />
      </div>
      <div className="mt-3">
        <TextAreaField
          label={t('settings.agentSkills.agentDescription')}
          value={agentDescription}
          onChange={setAgentDescription}
          minHeight={70}
          placeholder={t('settings.agentSkills.agentDescriptionPlaceholder')}
        />
      </div>
      <div className="mt-3">
        <TextField
          label={t('settings.agentSkills.displayDescription')}
          value={displayDescription}
          onChange={setDisplayDescription}
          placeholder={t('settings.agentSkills.displayDescriptionPlaceholder')}
        />
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="label px-1">{t('settings.agentSkills.files')}</div>
          <button type="button" className="chip h-7 px-2 text-xs" onClick={addFile}>
            <Icon name="plus" size={11} /> {t('settings.agentSkills.addFile')}
          </button>
        </div>
        <div className="space-y-3">
          {files.map((file, index) => (
            <div
              key={file.id}
              className={index === 0 ? 'space-y-2' : 'space-y-2 pt-3 shadow-[inset_0_1px_0_var(--ring-edge-soft)]'}
            >
              <div className="flex items-center gap-2">
                <input
                  value={file.path}
                  onChange={(event) => updateFile(file.id, { path: event.target.value })}
                  className="mono min-w-0 flex-1 rounded-[var(--radius-sm)] bg-(--color-surface-2) px-2.5 py-1.5 text-xs text-(--color-text) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] outline-none focus:shadow-[inset_0_0_0_1px_var(--color-accent)]"
                  aria-label={t('settings.agentSkills.filePath')}
                />
                {file.path !== 'SKILL.md' && (
                  <button type="button" className="icon-btn" onClick={() => removeFile(file.id)}>
                    <Icon name="trash" size={12} />
                  </button>
                )}
              </div>
              <textarea
                value={file.content}
                onChange={(event) => updateFile(file.id, { content: event.target.value })}
                className="mono min-h-[140px] w-full resize-y rounded-[var(--radius-sm)] bg-(--color-surface-2) px-2.5 py-2 text-xs leading-relaxed text-(--color-text) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] outline-none focus:shadow-[inset_0_0_0_1px_var(--color-accent)]"
                aria-label={t('settings.agentSkills.fileContent')}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="chip accent-active" onClick={handleSubmit}>
          {t('settings.agentSkills.saveSkill')}
        </button>
        <button type="button" className="chip" onClick={onClose}>
          {t('common.cancel')}
        </button>
        {error && (
          <span className="text-sm" style={{ color: 'var(--color-danger)' }}>
            {error}
          </span>
        )}
      </div>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="label mb-1 block px-1">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[var(--radius-sm)] bg-(--color-surface-2) px-2.5 py-2 text-sm text-(--color-text) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] outline-none placeholder:text-(--color-text-4) focus:shadow-[inset_0_0_0_1px_var(--color-accent)]"
      />
    </label>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  minHeight,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  minHeight: number
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="label mb-1 block px-1">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full resize-y rounded-[var(--radius-sm)] bg-(--color-surface-2) px-2.5 py-2 text-sm leading-relaxed text-(--color-text) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)] outline-none placeholder:text-(--color-text-4) focus:shadow-[inset_0_0_0_1px_var(--color-accent)]"
        style={{ minHeight }}
      />
    </label>
  )
}

function SkillPackageViewer({
  skill,
  selectedPath,
  onSelectPath,
  onClose,
}: {
  skill: AgentSkill
  selectedPath: string
  onSelectPath: (path: string) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const viewerRef = useRef<HTMLDivElement>(null)
  const selectedFile = skill.files.find((file) => file.path === selectedPath) ?? skill.files[0]

  useMountEffect(() => {
    const raf = requestAnimationFrame(() => {
      viewerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return () => cancelAnimationFrame(raf)
  })

  if (!selectedFile) return null
  return (
    <div ref={viewerRef} className="rounded-[var(--radius-md)] p-4 shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
      <div className="mb-3 flex items-center gap-2">
        <SkillIcon name={skill.icon} size={14} strokeWidth={2} className="text-(--color-accent)" />
        <div className="mono min-w-0 flex-1 truncate text-sm font-semibold text-(--color-text)">{skill.name}</div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="close" size={12} />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <div className="max-h-[320px] overflow-y-auto">
          {skill.files.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => onSelectPath(file.path)}
              data-active={file.path === selectedFile.path || undefined}
              className="mono block w-full truncate rounded-[var(--radius-xs)] px-2 py-1.5 text-left text-xs text-(--color-text-3) transition-colors hover:bg-(--color-surface-2) data-[active]:bg-(--color-accent-wash) data-[active]:text-(--color-text)"
            >
              {file.path}
            </button>
          ))}
        </div>
        <pre className="mono max-h-[420px] overflow-auto whitespace-pre-wrap rounded-[var(--radius-sm)] bg-(--color-surface-2) p-3 text-xs leading-relaxed text-(--color-text-2) shadow-[inset_0_0_0_1px_var(--ring-edge-soft)]">
          {selectedFile.content}
        </pre>
      </div>
    </div>
  )
}
