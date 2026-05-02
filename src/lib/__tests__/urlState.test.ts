import { describe, it, expect, vi, afterEach } from 'vitest'

import { readSimpleUrlParams, updateUrl } from '../urlState'

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

describe('readSimpleUrlParams', () => {
  it('parses core params and preserves raw param map for option lookup', () => {
    mockWindow('?m=flash-pro&r=2048x2048&a=16:9&q=high&n=3&p=hello&ws=1&is=1')
    expect(readSimpleUrlParams()).toEqual({
      modelId: 'flash-pro',
      resolution: '2048x2048',
      aspectRatio: '16:9',
      batchCount: 3,
      prompt: 'hello',
      agentMode: false,
      agentSessionId: null,
      rawParams: {
        m: 'flash-pro',
        r: '2048x2048',
        a: '16:9',
        q: 'high',
        n: '3',
        p: 'hello',
        ws: '1',
        is: '1',
      },
    })
  })

  it('returns nulls for core params and empty rawParams when absent', () => {
    mockWindow('')
    expect(readSimpleUrlParams()).toEqual({
      modelId: null,
      resolution: null,
      aspectRatio: null,
      batchCount: null,
      prompt: null,
      agentMode: false,
      agentSessionId: null,
      rawParams: {},
    })
  })

  it('parses active agent session id', () => {
    mockWindow('?agent=session-123')
    const params = readSimpleUrlParams()
    expect(params.agentMode).toBe(true)
    expect(params.agentSessionId).toBe('session-123')
  })

  it('treats agent=new sentinel as agent mode without a session', () => {
    mockWindow('?agent=new')
    const params = readSimpleUrlParams()
    expect(params.agentMode).toBe(true)
    expect(params.agentSessionId).toBeNull()
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
