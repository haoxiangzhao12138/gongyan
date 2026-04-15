import { supabase } from '@/lib/supabase'

export interface GitHubRepo {
  name: string
  full_name: string
  html_url: string
  description: string | null
  stargazers_count: number
  language: string | null
  fork: boolean
  archived: boolean
  updated_at: string
}

export async function fetchMyGitHubRepos(options?: {
  page?: number
  perPage?: number
  sort?: 'updated' | 'stars'
}): Promise<{
  repos: GitHubRepo[]
  hasNext: boolean
  error?: string
  code?: string
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return { repos: [], hasNext: false, error: '请先登录' }

  const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-repos`
  try {
    const response = await fetch(functionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({
        page: options?.page ?? 1,
        perPage: options?.perPage ?? 100,
        sort: options?.sort ?? 'updated',
      }),
    })

    const body = await response.json()

    if (!response.ok) {
      return {
        repos: [],
        hasNext: false,
        error: body.error ?? `HTTP ${response.status}`,
        code: body.code,
      }
    }

    return {
      repos: body.repos ?? [],
      hasNext: body.has_next ?? false,
      error: body.error,
      code: body.code,
    }
  } catch (err) {
    return { repos: [], hasNext: false, error: (err as Error).message }
  }
}
