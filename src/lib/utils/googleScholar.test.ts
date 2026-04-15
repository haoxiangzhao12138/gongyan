import { describe, it, expect } from 'vitest'
import { parseGoogleScholarId } from './googleScholar'

describe('parseGoogleScholarId', () => {
  it('extracts user ID from standard Google Scholar URL', () => {
    const url = 'https://scholar.google.com/citations?user=JicYPdAAAAAJ&hl=en'
    expect(parseGoogleScholarId(url)).toBe('JicYPdAAAAAJ')
  })

  it('extracts user ID from regional domain (.com.hk)', () => {
    const url = 'https://scholar.google.com.hk/citations?user=ABCDEF12345'
    expect(parseGoogleScholarId(url)).toBe('ABCDEF12345')
  })

  it('extracts user ID when other params present', () => {
    const url = 'https://scholar.google.com/citations?user=XYZ123&hl=zh-CN&oi=ao'
    expect(parseGoogleScholarId(url)).toBe('XYZ123')
  })

  it('returns null for non-Google Scholar URLs', () => {
    expect(parseGoogleScholarId('https://example.com/citations?user=123')).toBeNull()
    expect(parseGoogleScholarId('https://google.com/search?q=test')).toBeNull()
  })

  it('returns null for Google Scholar URL without user param', () => {
    expect(parseGoogleScholarId('https://scholar.google.com/citations?hl=en')).toBeNull()
  })

  it('returns null for invalid URL', () => {
    expect(parseGoogleScholarId('not-a-url')).toBeNull()
    expect(parseGoogleScholarId('')).toBeNull()
  })
})
