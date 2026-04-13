import { supabase } from '@/lib/supabase'
import type { HelpResponse } from '@/types/database'

export async function fetchResponses(postId: string) {
  const { data, error } = await supabase
    .from('help_responses')
    .select('*, responder:profiles!responder_id(id, full_name, avatar_url, badge_level, institution)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  return { data: (data as HelpResponse[]) ?? [], error: error?.message ?? null }
}

export async function createResponse(response: {
  post_id: string
  responder_id: string
  content: string
}) {
  const { data, error } = await supabase
    .from('help_responses')
    .insert(response)
    .select('*, responder:profiles!responder_id(id, full_name, avatar_url, badge_level, institution)')
    .single()

  return { data: data as HelpResponse | null, error: error?.message ?? null }
}

export async function acceptResponse(responseId: string) {
  const { error } = await supabase
    .from('help_responses')
    .update({ is_accepted: true })
    .eq('id', responseId)

  return { error: error?.message ?? null }
}

export async function deleteResponse(responseId: string) {
  const { error } = await supabase
    .from('help_responses')
    .delete()
    .eq('id', responseId)

  return { error: error?.message ?? null }
}
