import { describe, it, expect, vi, beforeEach } from 'vitest'
import { enrichPaperIds, searchAuthorByGoogleScholarId } from './semanticScholar'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('enrichPaperIds', () => {
  it('returns arxivId from Semantic Scholar response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        paperId: 'abc123',
        externalIds: {
          ArXiv: '2301.00001',
          DOI: '10.1234/test',
          CorpusId: 999,
        },
      }),
    })

    const result = await enrichPaperIds('10.1234/test')
    expect(result).toEqual({
      arxivId: '2301.00001',
      semanticScholarId: 'abc123',
    })
  })

  it('returns null arxivId when no ArXiv external ID', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        paperId: 'abc123',
        externalIds: { DOI: '10.1234/test' },
      }),
    })

    const result = await enrichPaperIds('10.1234/test')
    expect(result!.arxivId).toBeNull()
    expect(result!.semanticScholarId).toBe('abc123')
  })

  it('returns null on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const result = await enrichPaperIds('10.xxx/bad')
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'))
    const result = await enrichPaperIds('10.xxx/bad')
    expect(result).toBeNull()
  })

  it('encodes DOI in URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ paperId: 'x', externalIds: {} }),
    })

    await enrichPaperIds('10.1145/test.2023')
    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('DOI:10.1145%2Ftest.2023')
  })
})

describe('searchAuthorByGoogleScholarId', () => {
  it('returns author data on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { authorId: '12345', name: 'Test Author', paperCount: 50 },
        ],
      }),
    })

    const result = await searchAuthorByGoogleScholarId('JicYPdAAAAAJ')
    expect(result).toEqual({
      authorId: '12345',
      name: 'Test Author',
      paperCount: 50,
    })
  })

  it('returns null when no results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    })

    const result = await searchAuthorByGoogleScholarId('unknown')
    expect(result).toBeNull()
  })

  it('returns null on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const result = await searchAuthorByGoogleScholarId('bad')
    expect(result).toBeNull()
  })
})
