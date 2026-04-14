import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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

/** Star a GitHub repo using the given token */
async function starRepo(token: string, owner: string, repo: string) {
  return fetch(`https://api.github.com/user/starred/${owner}/${repo}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: '未授权' }, 401)
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

    if (authError || !user) {
      return jsonResponse({ error: '用户验证失败' }, 401)
    }

    // Parse request body
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return jsonResponse({ error: '缺少 URL 参数' }, 400)
    }

    // Extract owner/repo from GitHub URL
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!match) {
      return jsonResponse({ error: '无效的 GitHub 仓库 URL' }, 400)
    }
    const owner = match[1]
    const repo = match[2].replace(/\.git$/, '').split('?')[0].split('#')[0]

    // Read GitHub token from credentials table
    const { data: creds, error: credsError } = await supabase
      .from('github_credentials')
      .select('github_token, github_refresh_token')
      .eq('user_id', user.id)
      .single()

    if (credsError || !creds?.github_token) {
      return jsonResponse({ error: '请先绑定 GitHub 账号' }, 400)
    }

    // Call GitHub API to star the repo
    let ghResponse = await starRepo(creds.github_token, owner, repo)

    if (ghResponse.status === 204 || ghResponse.status === 304) {
      return jsonResponse({ success: true })
    }

    // On 401, try refreshing the token before giving up
    if (ghResponse.status === 401 && creds.github_refresh_token) {
      const ghClientId = Deno.env.get('GITHUB_CLIENT_ID')
      const ghClientSecret = Deno.env.get('GITHUB_CLIENT_SECRET')

      if (ghClientId && ghClientSecret) {
        const refreshed = await refreshGitHubToken(
          creds.github_refresh_token,
          ghClientId,
          ghClientSecret
        )

        if (refreshed) {
          // Save the new token
          await supabase
            .from('github_credentials')
            .update({
              github_token: refreshed.access_token,
              ...(refreshed.refresh_token
                ? { github_refresh_token: refreshed.refresh_token }
                : {}),
            })
            .eq('user_id', user.id)

          // Retry the star operation
          ghResponse = await starRepo(refreshed.access_token, owner, repo)

          if (ghResponse.status === 204 || ghResponse.status === 304) {
            return jsonResponse({ success: true })
          }
        }
      }
    }

    if (ghResponse.status === 401) {
      // Token expired and refresh failed — clear credentials
      await supabase
        .from('github_credentials')
        .delete()
        .eq('user_id', user.id)

      await supabase
        .from('profiles')
        .update({ github_username: null })
        .eq('id', user.id)

      return jsonResponse(
        { success: false, error: 'GitHub 授权已过期，请重新绑定', code: 'TOKEN_EXPIRED' },
        200
      )
    }

    if (ghResponse.status === 403) {
      const errorText = await ghResponse.text()
      await supabase
        .from('github_credentials')
        .delete()
        .eq('user_id', user.id)

      await supabase
        .from('profiles')
        .update({ github_username: null })
        .eq('id', user.id)

      return jsonResponse(
        {
          success: false,
          error: 'GitHub 权限不足（缺少 public_repo scope），请解绑后重新绑定',
          code: 'INSUFFICIENT_SCOPE',
          detail: errorText,
        },
        200
      )
    }

    if (ghResponse.status === 404) {
      return jsonResponse(
        { success: false, error: '仓库不存在或无权访问，请检查 GitHub 授权范围', code: 'REPO_NOT_FOUND' },
        200
      )
    }

    const errorBody = await ghResponse.text()
    return jsonResponse(
      { success: false, error: `GitHub API 错误: ${ghResponse.status}`, detail: errorBody },
      200
    )
  } catch (_err) {
    return jsonResponse({ error: '服务器内部错误' }, 500)
  }
})
