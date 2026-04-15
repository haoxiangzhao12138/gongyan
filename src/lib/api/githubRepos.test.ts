import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchMyGitHubRepos } from './githubRepos'

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'test-jwt-token',
          },
        },
      }),
    },
  },
}))

// Mock import.meta.env
vi.stubGlobal('import', {
  meta: {
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('fetchMyGitHubRepos', () => {
  it('returns repos on success', async () => {
    const mockRepos = [
      {
        name: 'my-project',
        full_name: 'user/my-project',
        html_url: 'https://github.com/user/my-project',
        description: 'A great project',
        stargazers_count: 42,
        language: 'TypeScript',
        fork: false,
        archived: false,
        updated_at: '2026-04-15T00:00:00Z',
      },
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ repos: mockRepos, has_next: true }),
    })

    const result = await fetchMyGitHubRepos({ page: 1, perPage: 30 })
    expect(result.repos).toEqual(mockRepos)
    expect(result.hasNext).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('sends correct request to Edge Function', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ repos: [], has_next: false }),
    })

    await fetchMyGitHubRepos({ page: 2, perPage: 50, sort: 'stars' })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/github-repos'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-jwt-token',
        }),
        body: JSON.stringify({ page: 2, perPage: 50, sort: 'stars' }),
      }),
    )
  })

  it('returns TOKEN_EXPIRED code when token expired', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        repos: [],
        has_next: false,
        error: 'GitHub 授权已过期，请重新绑定',
        code: 'TOKEN_EXPIRED',
      }),
    })

    const result = await fetchMyGitHubRepos()
    expect(result.repos).toEqual([])
    expect(result.code).toBe('TOKEN_EXPIRED')
    expect(result.error).toBe('GitHub 授权已过期，请重新绑定')
  })

  it('returns error on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: '服务器内部错误' }),
    })

    const result = await fetchMyGitHubRepos()
    expect(result.repos).toEqual([])
    expect(result.error).toBeTruthy()
  })

  it('returns error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'))

    const result = await fetchMyGitHubRepos()
    expect(result.repos).toEqual([])
    expect(result.error).toBe('Connection refused')
  })

  it('returns error when no session', async () => {
    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    } as never)

    const result = await fetchMyGitHubRepos()
    expect(result.repos).toEqual([])
    expect(result.error).toBe('请先登录')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('uses default options when none provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ repos: [], has_next: false }),
    })

    await fetchMyGitHubRepos()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ page: 1, perPage: 100, sort: 'updated' }),
      }),
    )
  })

  it('handles null repos and has_next in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    const result = await fetchMyGitHubRepos()
    expect(result.repos).toEqual([])
    expect(result.hasNext).toBe(false)
  })

  it('falls back to HTTP status when error message missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({}),
    })

    const result = await fetchMyGitHubRepos()
    expect(result.repos).toEqual([])
    expect(result.error).toBe('HTTP 403')
  })

  it('includes apikey header in request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ repos: [], has_next: false }),
    })

    await fetchMyGitHubRepos()

    const callArgs = mockFetch.mock.calls[0][1] as { headers: Record<string, string> }
    expect(callArgs.headers).toHaveProperty('apikey')
    expect(typeof callArgs.headers.apikey).toBe('string')
    expect(callArgs.headers.apikey.length).toBeGreaterThan(0)
  })
})
