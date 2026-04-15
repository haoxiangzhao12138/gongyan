import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  return { data: data as Profile | null, error: error?.message ?? null }
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'full_name' | 'bio' | 'research_field' | 'institution' | 'avatar_url' | 'github_username' | 'google_scholar_url'>>
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  return { data: data as Profile | null, error: error?.message ?? null }
}

export async function getPendingProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return { data: (data as Profile[]) ?? [], error: error?.message ?? null }
}

export async function getProfilesByStatus(status: Profile['status']) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })

  return { data: (data as Profile[]) ?? [], error: error?.message ?? null }
}

export async function approveUser(userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'approved' })
    .eq('id', userId)

  if (!error) {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'approval_approved',
      title: '申请已通过',
      body: '恭喜！你的加入申请已通过审批，现在可以使用共研平台的全部功能了。',
      link: '/',
    })
  }

  return { error: error?.message ?? null }
}

export async function rejectUser(userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'rejected' })
    .eq('id', userId)

  if (!error) {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'approval_rejected',
      title: '申请未通过',
      body: '很遗憾，你的加入申请未通过审批。如有疑问请联系管理员。',
    })
  }

  return { error: error?.message ?? null }
}
