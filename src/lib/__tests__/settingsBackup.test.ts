import { describe, expect, it } from 'vitest'

import {
  buildSettingsImportPlan,
  createDefaultSettingsImportSelection,
  deselectSettingsImportItems,
  getSelectedSettingsImportItemsForApply,
  SETTINGS_EXPORT_KIND,
  SETTINGS_EXPORT_VERSION,
  type SettingsExportBundle,
} from '../settingsBackup'

function webSettingsBundle(settings: SettingsExportBundle['settings']): SettingsExportBundle {
  return {
    kind: SETTINGS_EXPORT_KIND,
    version: SETTINGS_EXPORT_VERSION,
    exportedAt: '2026-05-05T00:00:00.000Z',
    settings,
  }
}

describe('settings backup import dependencies', () => {
  it('lets imported web API keys satisfy imported web provider preferences', () => {
    const plan = buildSettingsImportPlan(
      webSettingsBundle({
        webTools: {
          searchProvider: 'exa',
          fetchProvider: 'exa',
        },
        serviceProviders: {},
        preferences: {},
      }),
    )

    const searchProvider = plan.items.find((item) => item.id === 'webTools:searchProvider')
    const fetchProvider = plan.items.find((item) => item.id === 'webTools:fetchProvider')

    expect(searchProvider?.reasonKey).toBe('settings.backup.reason.requiresWebApiKey')
    expect(fetchProvider?.reasonKey).toBe('settings.backup.reason.requiresWebApiKey')
  })

  it('selects, deselects, and applies web provider dependencies as a group', () => {
    const plan = buildSettingsImportPlan(
      webSettingsBundle({
        webTools: {
          searchProvider: 'exa',
          fetchProvider: 'exa',
        },
        serviceProviders: {},
        preferences: {},
        skills: {
          userSkills: [],
          skillSettings: {},
        },
      }),
    )

    const withKeyPlan = buildSettingsImportPlan({
      ...webSettingsBundle({
        webTools: {
          searchProvider: 'exa',
          fetchProvider: 'exa',
        },
        serviceProviders: {},
        preferences: {},
        skills: {
          userSkills: [],
          skillSettings: {},
        },
      }),
      secrets: {
        webApiKeys: {
          exa: 'exa-test-key',
        },
      },
    })

    expect(plan.items.find((item) => item.id === 'webTools:searchProvider')?.reasonKey).toBe(
      'settings.backup.reason.requiresWebApiKey',
    )

    const searchProvider = withKeyPlan.items.find((item) => item.id === 'webTools:searchProvider')
    const fetchProvider = withKeyPlan.items.find((item) => item.id === 'webTools:fetchProvider')

    expect(searchProvider?.reasonKey).toBeUndefined()
    expect(fetchProvider?.reasonKey).toBeUndefined()
    expect(searchProvider?.dependencies).toEqual([
      {
        id: 'webApiKey:exa',
        itemId: 'secret:webApiKey:exa',
        reasonKey: 'settings.backup.reason.requiresWebApiKey',
      },
    ])

    const selectedIds = createDefaultSettingsImportSelection(withKeyPlan)
    expect(selectedIds.has('webTools:searchProvider')).toBe(true)
    expect(selectedIds.has('webTools:fetchProvider')).toBe(true)
    expect(selectedIds.has('secret:webApiKey:exa')).toBe(true)

    const withoutKeySelectedIds = deselectSettingsImportItems(withKeyPlan, selectedIds, ['secret:webApiKey:exa'])
    expect(withoutKeySelectedIds.has('webTools:searchProvider')).toBe(false)
    expect(withoutKeySelectedIds.has('webTools:fetchProvider')).toBe(false)

    expect(getSelectedSettingsImportItemsForApply(withKeyPlan, selectedIds).map((item) => item.id)).toEqual([
      'secret:webApiKey:exa',
      'webTools:searchProvider',
      'webTools:fetchProvider',
    ])
  })
})
