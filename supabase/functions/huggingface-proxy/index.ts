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

/**
 * Proxy for HuggingFace API calls.
 * huggingface.co is blocked in China, so all HF requests go through this Edge Function.
 *
 * Supported actions (passed in request body):
 *   - whoami:  Validate HF token → { valid, username }
 *   - paper:   Fetch paper by arXiv ID → HfPaper | null
 *   - search:  Search papers by query → HfPaper[]
 *   - models:  Fetch models for arXiv paper → Model[]
 *
 * Note: HuggingFace paper upvote is NOT possible via API.
 * The /api/papers/{id}/upvote endpoint rejects Bearer tokens (returns 401
 * "Invalid username or password" even with valid tokens that pass whoami).
 * HF intentionally blocks programmatic likes to prevent spam.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
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

    const body = await req.json()
    const { action } = body as { action: string }

    switch (action) {
      case 'whoami':
        return await handleWhoami(body.token)

      case 'paper':
        return await handlePaper(body.arxivId)

      case 'search':
        return await handleSearch(body.query)

      case 'models':
        return await handleModels(body.arxivId)

      default:
        return jsonResponse({ error: `未知操作: ${action}` }, 400)
    }
  } catch (_err) {
    return jsonResponse({ error: '服务器内部错误' }, 500)
  }
})

/** Validate a HuggingFace token via whoami-v2 */
async function handleWhoami(token: string) {
  if (!token) {
    return jsonResponse({ error: '缺少 token 参数' }, 400)
  }

  try {
    const res = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return jsonResponse({ valid: false, error: `HuggingFace 返回 ${res.status}: ${text}` })
    }

    const json = await res.json()
    return jsonResponse({
      valid: true,
      username: json.name ?? json.fullname ?? null,
    })
  } catch (err) {
    return jsonResponse({ valid: false, error: `HuggingFace API 请求失败: ${(err as Error).message}` })
  }
}

/** Fetch a HuggingFace paper by arXiv ID */
async function handlePaper(arxivId: string) {
  if (!arxivId) {
    return jsonResponse({ error: '缺少 arxivId 参数' }, 400)
  }

  try {
    const res = await fetch(
      `https://huggingface.co/api/papers/${encodeURIComponent(arxivId)}`,
    )

    if (!res.ok) {
      return jsonResponse({ paper: null })
    }

    const json = await res.json()
    return jsonResponse({
      paper: {
        arxiv_id: json.id ?? arxivId,
        title: json.title ?? '',
        github_repo: json.githubRepo ?? null,
        github_stars: json.githubStars ?? null,
        upvotes: json.upvotes ?? 0,
        summary: json.summary ?? null,
      },
    })
  } catch {
    return jsonResponse({ paper: null, error: 'HuggingFace API 请求失败' })
  }
}

/** Search papers by text query */
async function handleSearch(query: string) {
  if (!query) {
    return jsonResponse({ error: '缺少 query 参数' }, 400)
  }

  try {
    const res = await fetch(
      `https://huggingface.co/api/papers/search?q=${encodeURIComponent(query)}`,
    )

    if (!res.ok) {
      return jsonResponse({ papers: [] })
    }

    const json: Array<Record<string, unknown>> = await res.json()
    const papers = json.map((p) => ({
      arxiv_id: (p.id as string) ?? '',
      title: (p.title as string) ?? '',
      github_repo: (p.githubRepo as string) ?? null,
      github_stars: (p.githubStars as number) ?? null,
      upvotes: (p.upvotes as number) ?? 0,
      summary: (p.summary as string) ?? null,
    }))

    return jsonResponse({ papers })
  } catch {
    return jsonResponse({ papers: [], error: 'HuggingFace API 请求失败' })
  }
}

/** Fetch HuggingFace models linked to an arXiv paper */
async function handleModels(arxivId: string) {
  if (!arxivId) {
    return jsonResponse({ error: '缺少 arxivId 参数' }, 400)
  }

  try {
    const res = await fetch(
      `https://huggingface.co/api/models?filter=arxiv:${encodeURIComponent(arxivId)}&limit=10`,
    )

    if (!res.ok) {
      return jsonResponse({ models: [] })
    }

    const json: Array<{ id: string; likes: number }> = await res.json()
    const models = json.map((m) => ({ id: m.id, likes: m.likes ?? 0 }))

    return jsonResponse({ models })
  } catch {
    return jsonResponse({ models: [], error: 'HuggingFace API 请求失败' })
  }
}
