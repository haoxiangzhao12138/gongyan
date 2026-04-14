import { supabase } from '@/lib/supabase'

export function parseGitHubOwnerRepo(
  url: string
): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) return null
  const owner = match[1]
  const repo = match[2].replace(/\.git$/, '').split('?')[0].split('#')[0]
  return { owner, repo }
}

/** Fetch public repo info from GitHub API (no auth needed) */
export async function fetchGitHubRepoInfo(url: string): Promise<{
  name: string
  description: string | null
  stargazers_count: number
  html_url: string
} | null> {
  const parsed = parseGitHubOwnerRepo(url)
  if (!parsed) return null

  try {
    const response = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
      {
        headers: { Accept: 'application/vnd.github+json' },
      }
    )
    if (!response.ok) return null
    const data = await response.json()
    return {
      name: data.full_name ?? `${parsed.owner}/${parsed.repo}`,
      description: data.description ?? null,
      stargazers_count: data.stargazers_count ?? 0,
      html_url: data.html_url ?? url,
    }
  } catch {
    return null
  }
}

export async function starGitHubRepo(url: string): Promise<{
  success: boolean
  error: string | null
  code?: string
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return { success: false, error: '请先登录' }

  // Use direct fetch to bypass potential SDK issues
  const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-star`
  try {
    const response = await fetch(functionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({ url }),
    })

    const body = await response.json()

    if (!response.ok || body.success === false) {
      return {
        success: false,
        error: body.error ?? `HTTP ${response.status}`,
        code: body.code,
      }
    }

    return { success: true, error: null }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/** Batch check which GitHub URLs the user has already starred */
export async function checkGitHubStars(
  urls: string[]
): Promise<{ results: Record<string, boolean>; error: string | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return { results: {}, error: '请先登录' }

  try {
    const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-check-stars`
    const response = await fetch(functionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({ urls }),
    })

    const body = await response.json()

    if (!response.ok) {
      return { results: {}, error: body.error ?? `HTTP ${response.status}` }
    }

    return { results: body.results ?? {}, error: null }
  } catch {
    return { results: {}, error: '检测失败' }
  }
}

/** Star multiple GitHub repos, returns per-URL results */
export async function starGitHubRepos(
  urls: string[],
  onProgress?: (done: number, total: number) => void
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {}
  let done = 0

  // Star in parallel with concurrency limit of 3
  const queue = [...urls]
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length > 0) {
      const url = queue.shift()!
      const result = await starGitHubRepo(url)
      results[url] = result.success
      done++
      onProgress?.(done, urls.length)
    }
  })

  await Promise.all(workers)
  return results
}
