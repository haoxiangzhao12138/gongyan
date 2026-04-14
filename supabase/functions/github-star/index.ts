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
      .select('github_token')
      .eq('user_id', user.id)
      .single()

    if (credsError || !creds?.github_token) {
      return jsonResponse({ error: '请先绑定 GitHub 账号' }, 400)
    }

    // Call GitHub API to star the repo
    const ghResponse = await fetch(
      `https://api.github.com/user/starred/${owner}/${repo}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${creds.github_token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )

    if (ghResponse.status === 204 || ghResponse.status === 304) {
      return jsonResponse({ success: true })
    }

    if (ghResponse.status === 401) {
      // Token expired or revoked
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
      // If scope is insufficient, clear credentials so user re-binds with correct scopes
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
      // GitHub returns 404 for repos that don't exist or when token lacks scopes
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
  } catch (err) {
    return jsonResponse({ error: '服务器内部错误' }, 500)
  }
})
