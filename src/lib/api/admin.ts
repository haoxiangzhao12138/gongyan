import { supabase } from '@/lib/supabase'

export interface StarAllResult {
  total_attempted: number
  total_starred: number
  failed: number
  expired_tokens: string[]
}

export async function adminStarAll(): Promise<{
  data: StarAllResult | null
  error: string | null
}> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  if (!token) {
    return { data: null, error: '未登录' }
  }

  const response = await supabase.functions.invoke('admin-star-all', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.error) {
    return { data: null, error: response.error.message }
  }

  const body = response.data as Record<string, unknown>

  if (body.error) {
    return { data: null, error: body.error as string }
  }

  return { data: body as unknown as StarAllResult, error: null }
}
