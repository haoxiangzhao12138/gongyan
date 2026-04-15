/** HuggingFace Papers API — all calls proxied via Supabase Edge Function
 *  (huggingface.co is blocked in China, so we route through server-side proxy)
 *
 *  Note: HuggingFace paper upvote is NOT possible via API.
 *  The upvote endpoint rejects Bearer tokens; HF intentionally blocks
 *  programmatic likes to prevent spam. Users must upvote manually in browser.
 */

import { supabase } from '@/lib/supabase'

export interface HfPaper {
  arxiv_id: string
  title: string
  github_repo: string | null
  github_stars: number | null
  upvotes: number
  summary: string | null
}

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/huggingface-proxy`

/** Get auth headers for Edge Function calls */
async function getProxyHeaders(): Promise<Record<string, string> | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return null

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  }
}

/** Call the HuggingFace proxy Edge Function */
async function callProxy(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const headers = await getProxyHeaders()
  if (!headers) return null

  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    // Always try to parse JSON response (even on error status, the body may contain useful info)
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      console.error('[HF Proxy]', res.status, json)
      return null
    }
    return json
  } catch (err) {
    console.error('[HF Proxy] Network error:', err)
    return null
  }
}

/** Fetch a HuggingFace paper by its arXiv ID */
export async function fetchHfPaperByArxiv(arxivId: string): Promise<HfPaper | null> {
  const result = await callProxy({ action: 'paper', arxivId })
  return (result?.paper as HfPaper) ?? null
}

/** Search HuggingFace papers by text query */
export async function searchHfPapers(query: string): Promise<HfPaper[]> {
  const result = await callProxy({ action: 'search', query })
  return (result?.papers as HfPaper[]) ?? []
}

/** Validate a HuggingFace token and return username */
export async function validateHfToken(
  token: string,
): Promise<{ valid: boolean; username?: string; error?: string }> {
  const result = await callProxy({ action: 'whoami', token })

  if (!result) {
    return { valid: false, error: '代理服务请求失败' }
  }

  return {
    valid: result.valid as boolean,
    username: result.username as string | undefined,
    error: result.error as string | undefined,
  }
}

/** Fetch HuggingFace models linked to an arXiv paper */
export async function fetchHfModelsForPaper(
  arxivId: string,
): Promise<Array<{ id: string; likes: number }>> {
  const result = await callProxy({ action: 'models', arxivId })
  return (result?.models as Array<{ id: string; likes: number }>) ?? []
}
