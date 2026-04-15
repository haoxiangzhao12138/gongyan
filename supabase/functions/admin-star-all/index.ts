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
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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

interface Credential {
  user_id: string
  github_token: string
  github_refresh_token: string | null
}

interface HelpLink {
  url: string
}

/** Star a single repo with a given token. Returns true on success. */
async function starRepo(token: string, owner: string, repo: string): Promise<boolean> {
  const resp = await fetch(`https://api.github.com/user/starred/${owner}/${repo}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  return resp.status === 204 || resp.status === 304
}

/** Extract owner/repo from a GitHub URL */
function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) return null
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, '').split('?')[0].split('#')[0],
  }
}

/** Concurrency limiter: run tasks with max N at a time */
async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!
      await fn(item)
    }
  })
  await Promise.all(workers)
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

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

    // Check admin status
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('is_admin, status')
      .eq('id', user.id)
      .single()

    if (!adminProfile?.is_admin || adminProfile.status !== 'approved') {
      return json({ error: '需要管理员权限' }, 403)
    }

    // Fetch all active GitHub help links
    const { data: helpLinks, error: linksErr } = await supabase
      .from('showcase_help_links')
      .select('url')
      .eq('platform', 'github')
      .eq('is_active', true)

    if (linksErr) {
      return json({ error: '获取帮助链接失败' }, 500)
    }

    // Parse unique repos
    const repoSet = new Map<string, { owner: string; repo: string }>()
    for (const link of (helpLinks as HelpLink[]) ?? []) {
      const parsed = parseGithubUrl(link.url)
      if (parsed) {
        repoSet.set(`${parsed.owner}/${parsed.repo}`, parsed)
      }
    }
    const repos = Array.from(repoSet.values())

    if (repos.length === 0) {
      return json({ total_attempted: 0, total_starred: 0, failed: 0, expired_tokens: [] })
    }

    // Fetch all GitHub credentials (service_role bypasses RLS)
    const { data: allCreds, error: credsErr } = await supabase
      .from('github_credentials')
      .select('user_id, github_token, github_refresh_token')

    if (credsErr) {
      return json({ error: '获取凭据失败' }, 500)
    }

    // Get github_username for each user to skip self-repos
    const userIds = (allCreds as Credential[]).map((c) => c.user_id)
    const { data: userProfiles } = await supabase
      .from('profiles')
      .select('id, github_username')
      .in('id', userIds)

    const usernameMap = new Map<string, string>()
    for (const p of userProfiles ?? []) {
      if (p.github_username) {
        usernameMap.set(p.id, p.github_username.toLowerCase())
      }
    }

    const ghClientId = Deno.env.get('GITHUB_CLIENT_ID')
    const ghClientSecret = Deno.env.get('GITHUB_CLIENT_SECRET')

    let totalAttempted = 0
    let totalStarred = 0
    let failed = 0
    const expiredTokens: string[] = []

    // Process each user's credentials sequentially (token-level)
    for (const cred of allCreds as Credential[]) {
      let token = cred.github_token
      const username = usernameMap.get(cred.user_id)

      // Filter repos: skip user's own repos
      const userRepos = repos.filter(
        (r) => !username || r.owner.toLowerCase() !== username
      )

      if (userRepos.length === 0) continue

      let tokenExpired = false

      // Star repos with concurrency limit of 5 per user
      await withConcurrency(userRepos, 5, async ({ owner, repo }) => {
        if (tokenExpired) {
          failed++
          totalAttempted++
          return
        }

        totalAttempted++
        const success = await starRepo(token, owner, repo)

        if (success) {
          totalStarred++
          return
        }

        // Try token refresh on failure
        if (cred.github_refresh_token && ghClientId && ghClientSecret) {
          const refreshed = await refreshGitHubToken(
            cred.github_refresh_token,
            ghClientId,
            ghClientSecret
          )

          if (refreshed) {
            // Update stored credentials
            await supabase
              .from('github_credentials')
              .update({
                github_token: refreshed.access_token,
                ...(refreshed.refresh_token
                  ? { github_refresh_token: refreshed.refresh_token }
                  : {}),
              })
              .eq('user_id', cred.user_id)

            token = refreshed.access_token

            const retrySuccess = await starRepo(token, owner, repo)
            if (retrySuccess) {
              totalStarred++
              return
            }
          }
        }

        // Token is permanently expired
        tokenExpired = true
        expiredTokens.push(cred.user_id)
        failed++
      })
    }

    return json({
      total_attempted: totalAttempted,
      total_starred: totalStarred,
      failed,
      expired_tokens: [...new Set(expiredTokens)],
    })
  } catch (_err) {
    return json({ error: '服务器内部错误' }, 500)
  }
})
