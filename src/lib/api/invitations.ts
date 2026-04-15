import { supabase } from '@/lib/supabase'
import type { Invitation } from '@/types/database'

export async function validateInvitationCode(
  code: string
): Promise<{ valid: boolean; invitation: Invitation | null }> {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .is('used_by', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !data) {
    return { valid: false, invitation: null }
  }

  return { valid: true, invitation: data as Invitation }
}

export async function markInvitationUsed(
  invitationId: string,
  userId?: string
): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = {
    used_at: new Date().toISOString(),
    is_active: false,
  }
  if (userId) {
    updates.used_by = userId
  }

  const { error } = await supabase
    .from('invitations')
    .update(updates)
    .eq('id', invitationId)

  return { error: error?.message ?? null }
}

export async function generateInvitationCode(
  userId: string
): Promise<{ code: string | null; error: string | null }> {
  const code = generateCode()

  const { error } = await supabase.from('invitations').insert({
    code,
    created_by: userId,
  })

  if (error) {
    return { code: null, error: error.message }
  }

  return { code, error: null }
}

export async function getMyInvitations(userId: string) {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })

  return { data: (data as Invitation[]) ?? [], error: error?.message ?? null }
}

export async function consumeInvitation(
  invitationId: string,
  usedBy?: string
): Promise<{ consumed: boolean; error: string | null }> {
  const { data, error } = await supabase.rpc('consume_invitation', {
    p_invitation_id: invitationId,
    p_used_by: usedBy ?? null,
  })

  if (error) {
    return { consumed: false, error: error.message }
  }

  return { consumed: !!data, error: null }
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const segments = []
  for (let s = 0; s < 3; s++) {
    let segment = ''
    for (let i = 0; i < 4; i++) {
      segment += chars[Math.floor(Math.random() * chars.length)]
    }
    segments.push(segment)
  }
  return segments.join('-')
}
