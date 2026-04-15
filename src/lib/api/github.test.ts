import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseGitHubOwnerRepo,
  fetchGitHubRepoInfo,
  starGitHubRepo,
  checkGitHubStars,
  starGitHubRepos,
} from './github'

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

// ── parseGitHubOwnerRepo ──

describe('parseGitHubOwnerRepo', () => {
  it('parses standard GitHub URL', () => {
    const result = parseGitHubOwnerRepo('https://github.com/facebook/react')
    expect(result).toEqual({ owner: 'facebook', repo: 'react' })
  })

  it('strips .git suffix', () => {
    const result = parseGitHubOwnerRepo('https://github.com/org/repo.git')
    expect(result).toEqual({ owner: 'org', repo: 'repo' })
  })

  it('strips query string', () => {
    const result = parseGitHubOwnerRepo('https://github.com/org/repo?tab=readme')
    expect(result).toEqual({ owner: 'org', repo: 'repo' })
  })

  it('strips hash fragment', () => {
    const result = parseGitHubOwnerRepo('https://github.com/org/repo#section')
    expect(result).toEqual({ owner: 'org', repo: 'repo' })
  })

  it('handles URL with trailing path segments', () => {
    const result = parseGitHubOwnerRepo('https://github.com/org/repo/tree/main')
    expect(result).toEqual({ owner: 'org', repo: 'repo' })
  })

  it('returns null for non-GitHub URL', () => {
    expect(parseGitHubOwnerRepo('https://gitlab.com/org/repo')).toBeNull()
  })

  it('returns null for malformed URL', () => {
    expect(parseGitHubOwnerRepo('not-a-url')).toBeNull()
  })

  it('returns null for GitHub URL without repo', () => {
    expect(parseGitHubOwnerRepo('https://github.com/org')).toBeNull()
  })
})

// ── fetchGitHubRepoInfo ──

describe('fetchGitHubRepoInfo', () => {
  it('returns repo info on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        full_name: 'facebook/react',
        description: 'A JavaScript library',
        stargazers_count: 220000,
        html_url: 'https://github.com/facebook/react',
      }),
    })

    const result = await fetchGitHubRepoInfo('https://github.com/facebook/react')
    expect(result).toEqual({
      name: 'facebook/react',
      description: 'A JavaScript library',
      stargazers_count: 220000,
      html_url: 'https://github.com/facebook/react',
    })

    // Verify correct GitHub API call
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/facebook/react',
      expect.objectContaining({
        headers: { Accept: 'application/vnd.github+json' },
      }),
    )
  })

  it('returns null for non-GitHub URL', async () => {
    const result = await fetchGitHubRepoInfo('https://gitlab.com/foo/bar')
    expect(result).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns null on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    const result = await fetchGitHubRepoInfo('https://github.com/org/nonexistent')
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network'))
    const result = await fetchGitHubRepoInfo('https://github.com/org/repo')
    expect(result).toBeNull()
  })

  it('handles missing fields with defaults', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    const result = await fetchGitHubRepoInfo('https://github.com/org/repo')
    expect(result).toEqual({
      name: 'org/repo',
      description: null,
      stargazers_count: 0,
      html_url: 'https://github.com/org/repo',
    })
  })
})

// ── starGitHubRepo ──

describe('starGitHubRepo', () => {
  it('sends correct request to Edge Function', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })

    const result = await starGitHubRepo('https://github.com/org/repo')
    expect(result).toEqual({ success: true, error: null })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/github-star'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-jwt-token',
        }),
        body: JSON.stringify({ url: 'https://github.com/org/repo' }),
      }),
    )
  })

  it('returns error when Edge Function returns failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        error: 'GitHub 授权已过期，请重新绑定',
        code: 'TOKEN_EXPIRED',
      }),
    })

    const result = await starGitHubRepo('https://github.com/org/repo')
    expect(result).toEqual({
      success: false,
      error: 'GitHub 授权已过期，请重新绑定',
      code: 'TOKEN_EXPIRED',
    })
  })

  it('returns error on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: '服务器内部错误' }),
    })

    const result = await starGitHubRepo('https://github.com/org/repo')
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'))

    const result = await starGitHubRepo('https://github.com/org/repo')
    expect(result).toEqual({ success: false, error: 'Connection refused' })
  })

  it('returns error when no session', async () => {
    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    } as never)

    const result = await starGitHubRepo('https://github.com/org/repo')
    expect(result).toEqual({ success: false, error: '请先登录' })
  })
})

// ── checkGitHubStars ──

describe('checkGitHubStars', () => {
  it('returns star status for URLs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: {
          'https://github.com/org/repo-a': true,
          'https://github.com/org/repo-b': false,
        },
      }),
    })

    const { results, error } = await checkGitHubStars([
      'https://github.com/org/repo-a',
      'https://github.com/org/repo-b',
    ])

    expect(error).toBeNull()
    expect(results['https://github.com/org/repo-a']).toBe(true)
    expect(results['https://github.com/org/repo-b']).toBe(false)
  })

  it('sends correct request to Edge Function', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: {} }),
    })

    const urls = ['https://github.com/org/repo']
    await checkGitHubStars(urls)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/github-check-stars'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ urls }),
      }),
    )
  })

  it('returns empty results on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: '服务器内部错误' }),
    })

    const { results, error } = await checkGitHubStars(['https://github.com/org/repo'])
    expect(results).toEqual({})
    expect(error).toBeTruthy()
  })

  it('returns error when no session', async () => {
    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    } as never)

    const { results, error } = await checkGitHubStars(['https://github.com/org/repo'])
    expect(results).toEqual({})
    expect(error).toBe('请先登录')
  })

  it('returns error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network'))
    const { results, error } = await checkGitHubStars(['https://github.com/org/repo'])
    expect(results).toEqual({})
    expect(error).toBe('检测失败')
  })
})

// ── starGitHubRepos ──

describe('starGitHubRepos', () => {
  it('stars multiple repos with progress callback', async () => {
    // Each call to starGitHubRepo triggers one fetch for session + one for Edge Function
    // But since starGitHubRepos calls starGitHubRepo internally, we mock at fetch level
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

    const progress: Array<[number, number]> = []
    const results = await starGitHubRepos(
      ['https://github.com/a/b', 'https://github.com/c/d'],
      (done, total) => progress.push([done, total]),
    )

    expect(results['https://github.com/a/b']).toBe(true)
    expect(results['https://github.com/c/d']).toBe(true)
    expect(progress).toHaveLength(2)
    expect(progress[progress.length - 1]).toEqual([2, 2])
  })

  it('reports failure per-URL', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'fail' }),
      })

    const results = await starGitHubRepos([
      'https://github.com/a/b',
      'https://github.com/c/d',
    ])

    expect(results['https://github.com/a/b']).toBe(true)
    expect(results['https://github.com/c/d']).toBe(false)
  })

  it('handles empty URL list', async () => {
    const results = await starGitHubRepos([])
    expect(results).toEqual({})
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
