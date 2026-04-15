import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchHfPaperByArxiv,
  searchHfPapers,
  validateHfToken,
  fetchHfModelsForPaper,
} from './huggingface'

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

/** Helper: mock a successful proxy response */
function mockProxyResponse(body: Record<string, unknown>) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => body,
  })
}

/** Helper: mock a failed proxy response */
function mockProxyError() {
  mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
}

describe('fetchHfPaperByArxiv', () => {
  it('returns parsed paper when proxy returns paper', async () => {
    mockProxyResponse({
      paper: {
        arxiv_id: '2301.00001',
        title: 'Test Paper',
        github_repo: 'https://github.com/org/repo',
        github_stars: 1500,
        upvotes: 42,
        summary: 'A test summary',
      },
    })

    const result = await fetchHfPaperByArxiv('2301.00001')
    expect(result).toEqual({
      arxiv_id: '2301.00001',
      title: 'Test Paper',
      github_repo: 'https://github.com/org/repo',
      github_stars: 1500,
      upvotes: 42,
      summary: 'A test summary',
    })
  })

  it('sends correct action and arxivId to proxy', async () => {
    mockProxyResponse({ paper: null })
    await fetchHfPaperByArxiv('2301.00001')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/huggingface-proxy'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'paper', arxivId: '2301.00001' }),
      }),
    )
  })

  it('returns null when proxy returns null paper', async () => {
    mockProxyResponse({ paper: null })
    const result = await fetchHfPaperByArxiv('9999.99999')
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network'))
    const result = await fetchHfPaperByArxiv('2301.00001')
    expect(result).toBeNull()
  })
})

describe('searchHfPapers', () => {
  it('returns array of papers from proxy', async () => {
    mockProxyResponse({
      papers: [
        { arxiv_id: '2301.00001', title: 'Paper 1', upvotes: 10 },
        { arxiv_id: '2301.00002', title: 'Paper 2', upvotes: 20 },
      ],
    })

    const result = await searchHfPapers('transformer')
    expect(result).toHaveLength(2)
    expect(result[0].arxiv_id).toBe('2301.00001')
  })

  it('returns empty array on proxy error', async () => {
    mockProxyError()
    const result = await searchHfPapers('test')
    expect(result).toEqual([])
  })
})

describe('validateHfToken', () => {
  it('returns valid with username from proxy', async () => {
    mockProxyResponse({ valid: true, username: 'testuser' })
    const result = await validateHfToken('hf_valid')
    expect(result).toEqual({ valid: true, username: 'testuser', error: undefined })
  })

  it('returns invalid from proxy', async () => {
    mockProxyResponse({ valid: false })
    const result = await validateHfToken('hf_bad')
    expect(result).toEqual({ valid: false, username: undefined, error: undefined })
  })

  it('returns invalid on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'))
    const result = await validateHfToken('hf_bad')
    expect(result).toEqual({ valid: false, error: '代理服务请求失败' })
  })
})

describe('fetchHfModelsForPaper', () => {
  it('returns models from proxy', async () => {
    mockProxyResponse({
      models: [
        { id: 'org/model-1', likes: 100 },
        { id: 'org/model-2', likes: 50 },
      ],
    })

    const result = await fetchHfModelsForPaper('2301.00001')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('org/model-1')
  })

  it('returns empty on proxy error', async () => {
    mockProxyError()
    const result = await fetchHfModelsForPaper('bad')
    expect(result).toEqual([])
  })
})
