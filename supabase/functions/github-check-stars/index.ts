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

function parseOwnerRepo(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) return null
  const owner = match[1]
  const repo = match[2].replace(/\.git$/, '').split('?')[0].split('#')[0]
  return { owner, repo }
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
    const { urls } = await req.json()
    if (!Array.isArray(urls) || urls.length === 0) {
      return json({ error: '缺少 urls 参数' }, 400)
    }

    // Read GitHub token from credentials table
    const { data: creds, error: credsError } = await supabase
      .from('github_credentials')
      .select('github_token')
      .eq('user_id', user.id)
      .single()

    if (credsError || !creds?.github_token) {
      return json({ error: '请先绑定 GitHub 账号' }, 400)
    }

    // Limit URLs to prevent abuse
    const limitedUrls = urls.slice(0, 50)

    // Check star status for each URL in parallel
    const results: Record<string, boolean> = {}
    let tokenExpired = false

    const checks = limitedUrls.map(async (url: string) => {
      const parsed = parseOwnerRepo(url)
      if (!parsed) {
        results[url] = false
        return
      }

      try {
        const ghResponse = await fetch(
          `https://api.github.com/user/starred/${parsed.owner}/${parsed.repo}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${creds.github_token}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
          }
        )

        if (ghResponse.status === 401) {
          tokenExpired = true
          results[url] = false
          return
        }

        // 204 = starred, 404 = not starred
        results[url] = ghResponse.status === 204
      } catch {
        results[url] = false
      }
    })

    await Promise.all(checks)

    // If token expired, clear credentials and notify client
    if (tokenExpired) {
      await supabase
        .from('github_credentials')
        .delete()
        .eq('user_id', user.id)

      await supabase
        .from('profiles')
        .update({ github_username: null })
        .eq('id', user.id)

      return json({ results: {}, code: 'TOKEN_EXPIRED', error: 'GitHub 授权已过期，请重新绑定' })
    }

    return json({ results })
  } catch {
    return json({ error: '服务器内部错误' }, 500)
  }
})
