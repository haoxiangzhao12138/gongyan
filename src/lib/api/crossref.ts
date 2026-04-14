/** Fetch paper metadata from Crossref by DOI (free, no key needed) */
export async function fetchPaperByDOI(doiUrl: string): Promise<{
  title: string
  authors: string
  year: number | null
  venue: string | null
  doi: string
} | null> {
  // Extract DOI from URL or raw DOI string
  const doiMatch = doiUrl.match(/(?:doi\.org\/|^)(10\.\d{4,}\/\S+)/i)
  if (!doiMatch) return null
  const doi = doiMatch[1]

  try {
    const response = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      { headers: { Accept: 'application/json' } }
    )
    if (!response.ok) return null
    const data = await response.json()
    const work = data.message

    const title = work.title?.[0] ?? ''
    const authors = (work.author ?? [])
      .map((a: { given?: string; family?: string }) =>
        [a.given, a.family].filter(Boolean).join(' ')
      )
      .join(', ')
    const year =
      work.published?.['date-parts']?.[0]?.[0] ??
      work['published-print']?.['date-parts']?.[0]?.[0] ??
      null
    const venue =
      work['container-title']?.[0] ?? work['short-container-title']?.[0] ?? null

    return { title, authors, year, venue, doi }
  } catch {
    return null
  }
}

/** Check if a string looks like a DOI URL or raw DOI */
export function looksLikeDOI(input: string): boolean {
  return /(?:doi\.org\/|^10\.\d{4,}\/)/i.test(input.trim())
}
