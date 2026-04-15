import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://gongyan.pages.dev',
  'http://localhost:5173',
  'http://localhost:4173',
]

function getCorsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
  }
}

/** Try refreshing an expired GitHub token. Returns new token or null. */
async function refreshGitHubToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; refresh_token?: string } | null> {
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })
    if (!response.ok) return null
    const data = await response.json()
    if (data.error || !data.access_token) return null
    return { access_token: data.access_token, refresh_token: data.refresh_token }
  } catch {
    return null
  }
}

interface RepoItem {
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

/** Fetch user repos from GitHub API */
async function fetchUserRepos(
  token: string,
  page: number,
  perPage: number,
  sort: string
): Promise<{ status: number; repos: RepoItem[]; linkHeader: string | null }> {
  const url = `https://api.github.com/user/repos?sort=${sort}&per_page=${perPage}&page=${page}&type=owner`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    return { status: response.status, repos: [], linkHeader: null }
  }

  const data = await response.json()
  const repos: RepoItem[] = data.map((r: Record<string, unknown>) => ({
    name: r.name as string,
    full_name: r.full_name as string,
    html_url: r.html_url as string,
    description: (r.description as string) ?? null,
    stargazers_count: (r.stargazers_count as number) ?? 0,
    language: (r.language as string) ?? null,
    fork: (r.fork as boolean) ?? false,
    archived: (r.archived as boolean) ?? false,
    updated_at: (r.updated_at as string) ?? '',
  }))

  return { status: response.status, repos, linkHeader: response.headers.get('Link') }
}

/** Check if Link header indicates a next page */
function hasNextPage(linkHeader: string | null): boolean {
  if (!linkHeader) return false
  return linkHeader.includes('rel="next"')
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  function json(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: '未授权' }, 401)
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

    if (authError || !user) {
      return json({ error: '用户验证失败' }, 401)
    }

    // Parse request body
    const body = await req.json()
    const page = Math.max(1, Number(body.page) || 1)
    const perPage = Math.min(100, Math.max(1, Number(body.perPage) || 30))
    const sort = ['updated', 'stars', 'pushed', 'full_name'].includes(body.sort)
      ? body.sort
      : 'updated'

    // Read GitHub token from credentials table
    const { data: creds, error: credsError } = await supabase
      .from('github_credentials')
      .select('github_token, github_refresh_token')
      .eq('user_id', user.id)
      .single()

    if (credsError || !creds?.github_token) {
      return json({ error: '请先绑定 GitHub 账号' }, 400)
    }

    // Fetch repos from GitHub
    let result = await fetchUserRepos(creds.github_token, page, perPage, sort)

    // On 401, try refreshing the token before giving up
    if (result.status === 401 && creds.github_refresh_token) {
      const ghClientId = Deno.env.get('GITHUB_CLIENT_ID')
      const ghClientSecret = Deno.env.get('GITHUB_CLIENT_SECRET')

      if (ghClientId && ghClientSecret) {
        const refreshed = await refreshGitHubToken(
          creds.github_refresh_token,
          ghClientId,
          ghClientSecret
        )

        if (refreshed) {
          await supabase
            .from('github_credentials')
            .update({
              github_token: refreshed.access_token,
              ...(refreshed.refresh_token
                ? { github_refresh_token: refreshed.refresh_token }
                : {}),
            })
            .eq('user_id', user.id)

          result = await fetchUserRepos(refreshed.access_token, page, perPage, sort)
        }
      }
    }

    if (result.status === 401) {
      // Token expired and refresh failed — clear credentials
      await supabase
        .from('github_credentials')
        .delete()
        .eq('user_id', user.id)

      await supabase
        .from('profiles')
        .update({ github_username: null })
        .eq('id', user.id)

      return json({
        repos: [],
        has_next: false,
        error: 'GitHub 授权已过期，请重新绑定',
        code: 'TOKEN_EXPIRED',
      })
    }

    if (result.status !== 200) {
      return json({
        repos: [],
        has_next: false,
        error: `GitHub API 错误: ${result.status}`,
      })
    }

    return json({
      repos: result.repos,
      has_next: hasNextPage(result.linkHeader),
    })
  } catch (_err) {
    return json({ error: '服务器内部错误' }, 500)
  }
})
