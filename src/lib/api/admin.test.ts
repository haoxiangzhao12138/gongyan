import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetSession = vi.fn()
const mockInvoke = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
    functions: {
      invoke: mockInvoke,
    },
  },
}))

let adminStarAll: typeof import('./admin').adminStarAll

beforeEach(async () => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'test-jwt' } },
  })
  const mod = await import('./admin')
  adminStarAll = mod.adminStarAll
})

// ── adminStarAll ──

describe('adminStarAll', () => {
  it('returns star results on success', async () => {
    const starResult = {
      total_attempted: 10,
      total_starred: 8,
      failed: 2,
      expired_tokens: ['user-1'],
    }
    mockInvoke.mockResolvedValueOnce({ data: starResult, error: null })

    const result = await adminStarAll()

    expect(result.data).toEqual(starResult)
    expect(result.error).toBeNull()
    expect(mockInvoke).toHaveBeenCalledWith('admin-star-all', {
      headers: { Authorization: 'Bearer test-jwt' },
    })
  })

  it('returns error when not logged in', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
    })

    const result = await adminStarAll()

    expect(result).toEqual({ data: null, error: '未登录' })
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('returns error on Edge Function network error', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Function not found' },
    })

    const result = await adminStarAll()

    expect(result).toEqual({ data: null, error: 'Function not found' })
  })

  it('returns error from response body', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { error: '需要管理员权限' },
      error: null,
    })

    const result = await adminStarAll()

    expect(result).toEqual({ data: null, error: '需要管理员权限' })
  })

  it('handles zero results', async () => {
    const emptyResult = {
      total_attempted: 0,
      total_starred: 0,
      failed: 0,
      expired_tokens: [],
    }
    mockInvoke.mockResolvedValueOnce({ data: emptyResult, error: null })

    const result = await adminStarAll()

    expect(result.data).toEqual(emptyResult)
    expect(result.error).toBeNull()
  })

  it('handles all-failed scenario', async () => {
    const failedResult = {
      total_attempted: 5,
      total_starred: 0,
      failed: 5,
      expired_tokens: ['user-1', 'user-2'],
    }
    mockInvoke.mockResolvedValueOnce({ data: failedResult, error: null })

    const result = await adminStarAll()

    expect(result.data?.failed).toBe(5)
    expect(result.data?.expired_tokens).toHaveLength(2)
  })
})
