import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  compressStateBlob,
  decompressStateBlob,
  readSimpleUrlParams,
  readStateBlobParam,
  updateUrl,
  type StateBlob,
} from '../urlState'

// --- Test helpers ---

function makeScheme(title: string, text: string) {
  return { title, description: '', text }
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

  it('prompt + single scheme', async () => {
    const data: StateBlob = {
      prompt: '山脉\n\n风格：水彩\n\n色彩：冷色调',
      mode: 'structured',
      schemes: [makeScheme('方案 1', '山脉\n\n风格：水彩\n\n色彩：冷色调')],
      currentSchemeIndex: 0,
      originalPrompt: null,
    }
    expect(await decompressStateBlob(await compressStateBlob(data))).toEqual(data)
  })

  it('prompt + single edit scheme', async () => {
    const data: StateBlob = {
      prompt: '编辑类型：风格迁移\n\n编辑请求：转换为水彩画',
      mode: 'structured',
      schemes: [makeScheme('方案 1', '编辑类型：风格迁移\n\n编辑请求：转换为水彩画\n\n保持不变：人物位置')],
      currentSchemeIndex: 0,
      originalPrompt: null,
    }
    expect(await decompressStateBlob(await compressStateBlob(data))).toEqual(data)
  })

  it('multiple schemes with originalPrompt', async () => {
    const data: StateBlob = {
      prompt: '富士山\n\n风格：水彩',
      mode: 'structured',
      schemes: [
        makeScheme('方案 1', '富士山\n\n风格：水彩'),
        makeScheme('方案 2', '富士山\n\n风格：油画\n\n光影：黄金时段'),
        makeScheme('方案 3', '富士山\n\n构图：远景\n\n色彩：冷色调'),
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
        makeScheme('方案 1', '富士山\n\n风格：水彩'),
        makeScheme('方案 2', '富士山\n\n风格：电影海报\n\n光影：夜景霓虹'),
        makeScheme('方案 3', '富士山\n\n风格：极简主义'),
      ],
      currentSchemeIndex: 1,
      originalPrompt: '富士山'
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

  it('shorter text compresses smaller than longer text', async () => {
    const sparse: StateBlob = {
      prompt: 'test',
      mode: 'structured',
      schemes: [makeScheme('方案 1', '猫')],
      currentSchemeIndex: 0,
      originalPrompt: null,
    }
    const dense: StateBlob = {
      prompt: 'test',
      mode: 'structured',
      schemes: [makeScheme('方案 1', '主体描述文字\n\n构图：构图描述文字\n\n风格：风格描述文字\n\n光影：光影描述文字\n\n色彩：色彩描述文字\n\n画中文字：画中文字\n\n避免：约束描述文字')],
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
      prompt: '猫\n\n风格：油画',
      mode: 'structured',
      schemes: [makeScheme('方案 1', '猫\n\n风格：油画')],
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
