/** Semantic Scholar — DOI→arXiv enrichment bridge */

interface ExternalIds {
  ArXiv?: string
  DOI?: string
  CorpusId?: number
}

/** Enrich a DOI with arXiv ID via Semantic Scholar */
export async function enrichPaperIds(
  doi: string,
): Promise<{ arxivId: string | null; semanticScholarId: string | null } | null> {
  try {
    const res = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=externalIds`,
    )
    if (!res.ok) return null

    const json: { paperId?: string; externalIds?: ExternalIds } = await res.json()
    return {
      arxivId: json.externalIds?.ArXiv ?? null,
      semanticScholarId: json.paperId ?? null,
    }
  } catch {
    return null
  }
}

/** Search for an author by Google Scholar ID via Semantic Scholar */
export async function searchAuthorByGoogleScholarId(
  gsId: string,
): Promise<{ authorId: string; name: string; paperCount: number } | null> {
  try {
    const res = await fetch(
      `https://api.semanticscholar.org/graph/v1/author/search?query=${encodeURIComponent(gsId)}`,
    )
    if (!res.ok) return null

    const json: { data?: Array<{ authorId: string; name: string; paperCount: number }> } =
      await res.json()

    const first = json.data?.[0]
    if (!first) return null

    return {
      authorId: first.authorId,
      name: first.name,
      paperCount: first.paperCount ?? 0,
    }
  } catch {
    return null
  }
}
