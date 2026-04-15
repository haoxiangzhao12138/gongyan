import { describe, it, expect, vi, beforeEach } from 'vitest'

// Chainable supabase mock
function createChainMock() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['from', 'select', 'eq', 'single', 'upsert']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.single.mockResolvedValue({ data: null, error: null })
  chain.upsert.mockResolvedValue({ error: null })
  return chain
}

let mockChain: ReturnType<typeof createChainMock>

vi.mock('@/lib/supabase', () => {
  mockChain = createChainMock()
  return {
    supabase: {
      from: vi.fn().mockReturnValue(mockChain),
    },
  }
})

let getSystemSetting: typeof import('./systemSettings').getSystemSetting
let setSystemSetting: typeof import('./systemSettings').setSystemSetting

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('./systemSettings')
  getSystemSetting = mod.getSystemSetting
  setSystemSetting = mod.setSystemSetting
})

// ── getSystemSetting ──

describe('getSystemSetting', () => {
  it('returns value for existing key', async () => {
    mockChain.single.mockResolvedValueOnce({ data: { value: true }, error: null })

    const result = await getSystemSetting<boolean>('auto_approve')

    expect(result).toEqual({ value: true, error: null })
  })

  it('returns false boolean correctly', async () => {
    mockChain.single.mockResolvedValueOnce({ data: { value: false }, error: null })

    const result = await getSystemSetting<boolean>('auto_approve')

    expect(result).toEqual({ value: false, error: null })
  })

  it('returns null value on error', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'not found' },
    })

    const result = await getSystemSetting('missing_key')

    expect(result).toEqual({ value: null, error: 'not found' })
  })

  it('handles complex JSON values', async () => {
    const complexValue = { enabled: true, max_users: 100 }
    mockChain.single.mockResolvedValueOnce({ data: { value: complexValue }, error: null })

    const result = await getSystemSetting<typeof complexValue>('complex_setting')

    expect(result.value).toEqual(complexValue)
    expect(result.error).toBeNull()
  })
})

// ── setSystemSetting ──

describe('setSystemSetting', () => {
  it('upserts setting successfully', async () => {
    mockChain.upsert.mockResolvedValueOnce({ error: null })

    const result = await setSystemSetting('auto_approve', true)

    expect(result).toEqual({ error: null })
  })

  it('returns error on failure', async () => {
    mockChain.upsert.mockResolvedValueOnce({ error: { message: 'permission denied' } })

    const result = await setSystemSetting('auto_approve', true)

    expect(result).toEqual({ error: 'permission denied' })
  })

  it('handles boolean value serialization', async () => {
    mockChain.upsert.mockResolvedValueOnce({ error: null })

    const result = await setSystemSetting('auto_approve', false)

    expect(result).toEqual({ error: null })
  })

  it('handles object value serialization', async () => {
    mockChain.upsert.mockResolvedValueOnce({ error: null })

    const result = await setSystemSetting('config', { nested: true })

    expect(result).toEqual({ error: null })
  })
})
