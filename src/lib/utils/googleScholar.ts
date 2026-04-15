/**
 * Extract Google Scholar user ID from a profile URL.
 * Handles URLs like:
 *   https://scholar.google.com/citations?user=XXXXX&hl=en
 *   https://scholar.google.com.hk/citations?user=XXXXX
 */
export function parseGoogleScholarId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.startsWith('scholar.google.')) return null
    return parsed.searchParams.get('user')
  } catch {
    return null
  }
}
