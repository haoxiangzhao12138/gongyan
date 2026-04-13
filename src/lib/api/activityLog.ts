import { supabase } from '@/lib/supabase'
import type { ActivityLog } from '@/types/database'

export async function logActivity(
  actorId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: Record<string, unknown>
) {
  const { error } = await supabase.from('activity_log').insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata: metadata ?? {},
  })

  return { error: error?.message ?? null }
}

export async function getRecentActivity(limit = 20) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, actor:profiles!actor_id(id, full_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limit)

  return { data: (data as ActivityLog[]) ?? [], error: error?.message ?? null }
}
