/** DBLP author and publication search — replaces OpenAlex */

export interface DblpAuthor {
  pid: string
  display_name: string
  url: string
  affiliation?: string
  aliases?: string[]
}

export interface DblpWork {
  dblp_key: string
  title: string
  doi: string | null
  year: number | null
  venue: string | null
  authors: string[]
  url: string
  type: string
}

// ── Raw DBLP response shapes ──

interface DblpAuthorHit {
  info: {
    author:
      | string
      | { text?: string; '@pid'?: string; $?: string }
    aliases?: { alias: string | string[] }
    url?: string
    notes?: { note: { text: string; '@type'?: string } | Array<{ text: string; '@type'?: string }> }
  }
}

interface DblpPublHit {
  info: {
    key: string
    title: string | { text: string }
    doi?: string
    year?: string
    venue?: string
    authors?: {
      author: string | { text: string } | Array<string | { text: string }>
    }
    ee?: string | { text: string } | Array<string | { text: string }>
    type?: string
  }
}

function textOf(v: string | { text?: string; $?: string } | undefined): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  return v.text ?? v.$ ?? ''
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return []
  return Array.isArray(v) ? v : [v]
}

function pidOf(v: string | { text?: string; '@pid'?: string; $?: string } | undefined): string {
  if (!v) return ''
  if (typeof v === 'string') return ''
  return v['@pid'] ?? ''
}

/** Search DBLP authors by name */
export async function searchDblpAuthors(name: string): Promise<DblpAuthor[] | null> {
  try {
    const url = `https://dblp.org/search/author/api?q=${encodeURIComponent(name)}&format=json&h=20`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null

    const json = await res.json()
    const hits: DblpAuthorHit[] = asArray(json?.result?.hits?.hit)

    return hits.map((h) => {
      const { info } = h
      const authorField = info.author
      const display_name = textOf(authorField)
      const pid = pidOf(authorField)

      // Extract affiliation from notes
      const notes = asArray(
        info.notes?.note
          ? (Array.isArray(info.notes.note) ? info.notes.note : [info.notes.note])
          : []
      )
      const affiliationNote = notes.find((n) => n['@type'] === 'affiliation')
      const affiliation = affiliationNote?.text

      // Aliases
      const aliases = info.aliases
        ? asArray(info.aliases.alias).map((a) => (typeof a === 'string' ? a : ''))
        : undefined

      return {
        pid,
        display_name,
        url: info.url ?? `https://dblp.org/pid/${pid}`,
        affiliation,
        aliases: aliases?.length ? aliases : undefined,
      }
    })
  } catch {
    return null
  }
}

/** Fetch publications for a DBLP author PID */
export async function fetchDblpWorksByAuthor(
  authorPid: string,
  page = 1,
  perPage = 50,
): Promise<{ works: DblpWork[]; totalCount: number } | null> {
  try {
    const offset = (page - 1) * perPage
    const url = `https://dblp.org/search/publ/api?q=author:${encodeURIComponent(authorPid)}&format=json&h=${perPage}&f=${offset}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null

    const json = await res.json()
    const totalCount = parseInt(json?.result?.hits?.['@total'] ?? '0', 10)
    const hits: DblpPublHit[] = asArray(json?.result?.hits?.hit)

    const works: DblpWork[] = hits.map((h) => {
      const { info } = h
      const title = textOf(info.title)
      const doi = info.doi ?? null

      // Authors — can be string, object, or array
      const rawAuthors = info.authors?.author
      const authors = asArray(rawAuthors).map((a) => textOf(a as string | { text: string }))

      // Electronic edition URL — pick first if array
      const eeList = asArray(info.ee).map((e) => textOf(e as string | { text: string }))
      const eeUrl = eeList[0] ?? ''

      return {
        dblp_key: info.key,
        title,
        doi,
        year: info.year ? parseInt(info.year, 10) : null,
        venue: info.venue ?? null,
        authors,
        url: eeUrl,
        type: info.type ?? '',
      }
    })

    // Sort by year descending (DBLP returns by relevance)
    works.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))

    return { works, totalCount }
  } catch {
    return null
  }
}
