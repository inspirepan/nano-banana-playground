import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  compressStateBlob,
  decompressStateBlob,
  readSimpleUrlParams,
  readStateBlobParam,
  updateUrl,
  type StateBlob,
} from '../urlState'
import type { PromptScheme } from '../types'

// --- Test helpers ---

const EMPTY_FIELDS: PromptScheme['fields'] = {
  mode: 'generate',
  subject: '', action: '', scene: '', composition: '', style: '',
  lighting: '', colorPalette: '', textInImage: '', constraints: '',
  editType: '', primaryRequest: '', referenceRole: '', targetScene: '', invariants: '',
}

function makeScheme(
  title: string,
  overrides: Partial<PromptScheme['fields']> = {},
): PromptScheme {
  return { title, description: '', fields: { ...EMPTY_FIELDS, ...overrides } }
}

// Stubs window for URL-related tests. Returns the replaceState spy.
function mockWindow(search = '') {
  const replaceState = vi.fn()
  vi.stubGlobal('window', {
    location: { search, pathname: '/' },
    history: { replaceState },
  })
  return replaceState
}

afterEach(() => vi.unstubAllGlobals())

// --- Round-trip tests ---

describe('compressStateBlob / decompressStateBlob round-trip', () => {
  it('prompt only (text mode, no schemes)', async () => {
    const data: StateBlob = { prompt: '一只橘猫坐在窗台上', mode: 'text', schemes: [], currentSchemeIndex: 0, originalPrompt: null }
    expect(await decompressStateBlob(await compressStateBlob(data))).toEqual(data)
  })

  it('empty state', async () => {
    const data: StateBlob = { prompt: '', mode: 'text', schemes: [], currentSchemeIndex: 0, originalPrompt: null }
    expect(await decompressStateBlob(await compressStateBlob(data))).toEqual(data)
  })

  it('prompt + single generate scheme (sparse fields)', async () => {
    const data: StateBlob = {
      prompt: '风格：水彩\n色彩：冷色调',
      mode: 'structured',
      schemes: [makeScheme('方案 1', { subject: '山脉', style: '水彩' })],
      currentSchemeIndex: 0,
      originalPrompt: null,
    }
    expect(await decompressStateBlob(await compressStateBlob(data))).toEqual(data)
  })

  it('prompt + single edit scheme', async () => {
    const data: StateBlob = {
      prompt: '编辑类型：风格迁移\n编辑请求：转换为水彩画',
      mode: 'structured',
      schemes: [makeScheme('方案 1', {
        mode: 'edit',
        editType: '风格迁移',
        primaryRequest: '转换为水彩画',
        invariants: '保持人物位置不变',
      })],
      currentSchemeIndex: 0,
      originalPrompt: null,
    }
    expect(await decompressStateBlob(await compressStateBlob(data))).toEqual(data)
  })

  it('multiple schemes with originalPrompt', async () => {
    const data: StateBlob = {
      prompt: '主体：富士山\n风格：水彩',
      mode: 'structured',
      schemes: [
        makeScheme('方案 1', { subject: '富士山', style: '水彩' }),
        makeScheme('方案 2', { subject: '富士山', style: '油画', lighting: '黄金时段' }),
        makeScheme('方案 3', { subject: '富士山', composition: '远景', colorPalette: '冷色调' }),
      ],
      currentSchemeIndex: 2,
      originalPrompt: '富士山',
    }
    expect(await decompressStateBlob(await compressStateBlob(data))).toEqual(data)
  })

  it('text mode keeps schemes and selected scheme index', async () => {
    const data: StateBlob = {
      prompt: '把第二个方案改成更克制、更写实的电影海报风格',
      mode: 'text',
      schemes: [
        makeScheme('方案 1', { subject: '富士山', style: '水彩' }),
        makeScheme('方案 2', { subject: '富士山', style: '电影海报', lighting: '夜景霓虹' }),
        makeScheme('方案 3', { subject: '富士山', style: '极简主义' }),
      ],
      currentSchemeIndex: 1,
      originalPrompt: '富士山'
    }
    expect(await decompressStateBlob(await compressStateBlob(data))).toEqual(data)
  })

  it('scheme with all fields filled', async () => {
    const data: StateBlob = {
      prompt: 'full fields test',
      mode: 'structured',
      schemes: [makeScheme('方案 1', {
        subject: '主体', action: '动作', scene: '场景', composition: '构图',
        style: '风格', lighting: '光影', colorPalette: '色彩',
        textInImage: '画中文字', constraints: '约束',
      })],
      currentSchemeIndex: 0,
      originalPrompt: '原始提示词',
    }
    expect(await decompressStateBlob(await compressStateBlob(data))).toEqual(data)
  })

  it('unicode, emoji, and special chars in prompt', async () => {
    const data: StateBlob = {
      prompt: '日本の富士山 🗻 with "quotes" & <brackets> — en dash',
      mode: 'text',
      schemes: [],
      currentSchemeIndex: 0,
      originalPrompt: null,
    }
    expect(await decompressStateBlob(await compressStateBlob(data))).toEqual(data)
  })

  it('long prompt (several hundred characters)', async () => {
    const long = '一只橘猫坐在窗台上，望向夕阳。'.repeat(30)
    const data: StateBlob = { prompt: long, mode: 'text', schemes: [], currentSchemeIndex: 0, originalPrompt: null }
    expect(await decompressStateBlob(await compressStateBlob(data))).toEqual(data)
  })
})

// --- Strip/restore correctness ---

describe('stripFields: empty fields are stripped before compression and restored after', () => {
  it('restores all 15 field keys even when scheme has mostly empty fields', async () => {
    const data: StateBlob = {
      prompt: 'test',
      mode: 'structured',
      schemes: [makeScheme('方案 1', { subject: '猫' })],
      currentSchemeIndex: 0,
      originalPrompt: null,
    }
    const restored = await decompressStateBlob(await compressStateBlob(data))
    expect(Object.keys(restored.schemes[0].fields).sort()).toEqual(
      Object.keys(EMPTY_FIELDS).sort(),
    )
  })

  it('preserves filled fields and restores empty ones as empty strings', async () => {
    const data: StateBlob = {
      prompt: 'test',
      mode: 'structured',
      schemes: [makeScheme('方案 1', { subject: '猫', style: '水彩' })],
      currentSchemeIndex: 0,
      originalPrompt: null,
    }
    const { fields } = (await decompressStateBlob(await compressStateBlob(data))).schemes[0]
    expect(fields.subject).toBe('猫')
    expect(fields.style).toBe('水彩')
    expect(fields.action).toBe('')
    expect(fields.scene).toBe('')
    expect(fields.lighting).toBe('')
  })

  it('stripping reduces compressed output size compared to full JSON', async () => {
    // A scheme with mostly empty fields should compress smaller than
    // a scheme with all fields filled with placeholder text.
    const sparse: StateBlob = {
      prompt: 'test',
      mode: 'structured',
      schemes: [makeScheme('方案 1', { subject: '猫' })],
      currentSchemeIndex: 0,
      originalPrompt: null,
    }
    const dense: StateBlob = {
      prompt: 'test',
      mode: 'structured',
      schemes: [makeScheme('方案 1', {
        subject: '主体描述文字', action: '动作描述文字', scene: '场景描述文字',
        composition: '构图描述文字', style: '风格描述文字', lighting: '光影描述文字',
        colorPalette: '色彩描述文字', textInImage: '画中文字', constraints: '约束描述文字',
      })],
      currentSchemeIndex: 0,
      originalPrompt: null,
    }
    const sparseLen = (await compressStateBlob(sparse)).length
    const denseLen = (await compressStateBlob(dense)).length
    expect(sparseLen).toBeLessThan(denseLen)
  })
})

// --- readSimpleUrlParams ---

describe('readSimpleUrlParams', () => {
  it('parses all four params', () => {
    mockWindow('?m=flash-pro&r=2048x2048&a=16:9&n=3')
    expect(readSimpleUrlParams()).toEqual({
      modelId: 'flash-pro',
      resolution: '2048x2048',
      aspectRatio: '16:9',
      batchCount: 3,
    })
  })

  it('returns nulls when params are absent', () => {
    mockWindow('')
    expect(readSimpleUrlParams()).toEqual({
      modelId: null,
      resolution: null,
      aspectRatio: null,
      batchCount: null,
    })
  })

  it('returns null batchCount for non-numeric n', () => {
    mockWindow('?n=abc')
    expect(readSimpleUrlParams().batchCount).toBeNull()
  })

  it('ignores unrelated params', () => {
    mockWindow('?foo=bar&m=flash-2.0')
    expect(readSimpleUrlParams().modelId).toBe('flash-2.0')
    expect(readSimpleUrlParams().resolution).toBeNull()
  })
})

// --- readStateBlobParam ---

describe('readStateBlobParam', () => {
  it('returns the s param value', () => {
    mockWindow('?s=abc-123_XYZ')
    expect(readStateBlobParam()).toBe('abc-123_XYZ')
  })

  it('returns null when s is absent', () => {
    mockWindow('?m=flash-2.0')
    expect(readStateBlobParam()).toBeNull()
  })
})

// --- updateUrl ---

describe('updateUrl', () => {
  it('sets params and calls replaceState', () => {
    const replaceState = mockWindow('')
    updateUrl({ m: 'flash-pro', r: '1024x1024' })
    expect(replaceState).toHaveBeenCalledOnce()
    const url = replaceState.mock.calls[0][2] as string
    expect(url).toContain('m=flash-pro')
    expect(url).toContain('r=1024x1024')
  })

  it('removes params whose value is null', () => {
    const replaceState = mockWindow('?m=flash-pro&r=1024x1024')
    updateUrl({ m: null })
    const url = replaceState.mock.calls[0][2] as string
    expect(url).not.toContain('m=')
    expect(url).toContain('r=1024x1024')
  })

  it('removes params whose value is empty string', () => {
    const replaceState = mockWindow('?m=flash-pro')
    updateUrl({ m: '' })
    const url = replaceState.mock.calls[0][2] as string
    expect(url).not.toContain('m=')
  })

  it('produces a clean path when all params are cleared', () => {
    const replaceState = mockWindow('?m=flash-pro')
    updateUrl({ m: null })
    const url = replaceState.mock.calls[0][2] as string
    expect(url).toBe('/')
  })

  it('preserves existing params not mentioned in the update', () => {
    const replaceState = mockWindow('?m=flash-pro&n=2')
    updateUrl({ r: '512x512' })
    const url = replaceState.mock.calls[0][2] as string
    expect(url).toContain('m=flash-pro')
    expect(url).toContain('n=2')
    expect(url).toContain('r=512x512')
  })
})

// --- Full pipeline: compress → URL → decompress ---

describe('full pipeline: write to URL then read back', () => {
  it('prompt-only text state survives a URL write/read cycle', async () => {
    const original: StateBlob = {
      prompt: '一只猫坐在窗台，望向夕阳',
      mode: 'text',
      schemes: [],
      currentSchemeIndex: 0,
      originalPrompt: null,
    }

    const replaceState = mockWindow('')
    const compressed = await compressStateBlob(original)
    updateUrl({ s: compressed })

    const writtenUrl = replaceState.mock.calls[0][2] as string
    const sParam = new URLSearchParams(writtenUrl.split('?')[1]).get('s')
    expect(sParam).not.toBeNull()

    const restored = await decompressStateBlob(sParam!)
    expect(restored).toEqual(original)
  })

  it('state survives a URL write/read cycle', async () => {
    const original: StateBlob = {
      prompt: '一只猫坐在窗台，望向夕阳',
      mode: 'structured',
      schemes: [makeScheme('方案 1', { subject: '猫', style: '油画' })],
      currentSchemeIndex: 0,
      originalPrompt: '一只猫',
    }

    const replaceState = mockWindow('')
    const compressed = await compressStateBlob(original)
    updateUrl({ s: compressed })

    // Extract the s value from the URL that replaceState was called with
    const writtenUrl = replaceState.mock.calls[0][2] as string
    const sParam = new URLSearchParams(writtenUrl.split('?')[1]).get('s')
    expect(sParam).not.toBeNull()

    const restored = await decompressStateBlob(sParam!)
    expect(restored).toEqual(original)
  })
})
