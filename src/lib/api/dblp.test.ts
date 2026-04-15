import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchDblpAuthors, fetchDblpWorksByAuthor } from './dblp'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('searchDblpAuthors', () => {
  it('parses author results with pid and affiliation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          hits: {
            hit: [
              {
                info: {
                  author: { text: 'Yann LeCun', '@pid': 'l/YannLeCun' },
                  url: 'https://dblp.org/pid/l/YannLeCun',
                  notes: {
                    note: { text: 'New York University', '@type': 'affiliation' },
                  },
                },
              },
            ],
          },
        },
      }),
    })

    const result = await searchDblpAuthors('Yann LeCun')
    expect(result).toHaveLength(1)
    expect(result![0]).toEqual({
      pid: 'l/YannLeCun',
      display_name: 'Yann LeCun',
      url: 'https://dblp.org/pid/l/YannLeCun',
      affiliation: 'New York University',
      aliases: undefined,
    })
  })

  it('handles single hit (not array)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          hits: {
            hit: {
              info: {
                author: { text: 'Test Author', '@pid': 'a/TestAuthor' },
              },
            },
          },
        },
      }),
    })

    const result = await searchDblpAuthors('Test Author')
    expect(result).toHaveLength(1)
    expect(result![0].display_name).toBe('Test Author')
  })

  it('returns null on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const result = await searchDblpAuthors('nobody')
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    const result = await searchDblpAuthors('test')
    expect(result).toBeNull()
  })

  it('handles empty results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { hits: {} },
      }),
    })

    const result = await searchDblpAuthors('zzzzzzz')
    expect(result).toEqual([])
  })

  it('handles author with aliases', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          hits: {
            hit: [
              {
                info: {
                  author: { text: 'Wei Zhang', '@pid': 'z/WeiZhang' },
                  aliases: { alias: ['W. Zhang', 'Zhang Wei'] },
                },
              },
            ],
          },
        },
      }),
    })

    const result = await searchDblpAuthors('Wei Zhang')
    expect(result![0].aliases).toEqual(['W. Zhang', 'Zhang Wei'])
  })
})

describe('fetchDblpWorksByAuthor', () => {
  it('parses works with polymorphic author/ee fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          hits: {
            '@total': '2',
            hit: [
              {
                info: {
                  key: 'conf/nips/Smith2023',
                  title: 'A Great Paper',
                  doi: '10.1234/test',
                  year: '2023',
                  venue: 'NeurIPS',
                  authors: {
                    author: [{ text: 'Alice' }, { text: 'Bob' }],
                  },
                  ee: { text: 'https://arxiv.org/abs/2301.00001' },
                  type: 'Conference and Workshop Papers',
                },
              },
              {
                info: {
                  key: 'journals/corr/Smith2022',
                  title: 'Another Paper',
                  year: '2022',
                  authors: {
                    author: 'Single Author',
                  },
                  ee: ['https://arxiv.org/abs/2201.00001', 'https://doi.org/10.xxx'],
                  type: 'Informal and Other Publications',
                },
              },
            ],
          },
        },
      }),
    })

    const result = await fetchDblpWorksByAuthor('s/Smith')
    expect(result).not.toBeNull()
    expect(result!.totalCount).toBe(2)
    expect(result!.works).toHaveLength(2)

    // Sorted by year descending
    expect(result!.works[0].year).toBe(2023)
    expect(result!.works[1].year).toBe(2022)

    // First work
    const w0 = result!.works[0]
    expect(w0.dblp_key).toBe('conf/nips/Smith2023')
    expect(w0.title).toBe('A Great Paper')
    expect(w0.doi).toBe('10.1234/test')
    expect(w0.venue).toBe('NeurIPS')
    expect(w0.authors).toEqual(['Alice', 'Bob'])
    expect(w0.url).toBe('https://arxiv.org/abs/2301.00001')

    // Second work — single author string, ee as array of strings
    const w1 = result!.works[1]
    expect(w1.authors).toEqual(['Single Author'])
    expect(w1.doi).toBeNull()
    expect(w1.url).toBe('https://arxiv.org/abs/2201.00001')
  })

  it('returns null on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const result = await fetchDblpWorksByAuthor('x/Nobody')
    expect(result).toBeNull()
  })

  it('calculates offset for pagination', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { hits: { '@total': '0', hit: [] } },
      }),
    })

    await fetchDblpWorksByAuthor('test', 3, 25)
    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('f=50') // (3-1)*25 = 50
    expect(calledUrl).toContain('h=25')
  })
})
