import { supabase } from '@/lib/supabase'
import type { ShowcaseHelpLink, HelpLinkPlatform } from '@/types/database'

export async function fetchHelpLinksByItem(itemId: string) {
  const { data, error } = await supabase
    .from('showcase_help_links')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at')

  return { data: (data as ShowcaseHelpLink[]) ?? [], error: error?.message ?? null }
}

export async function fetchAllActiveHelpLinks() {
  const { data, error } = await supabase
    .from('showcase_help_links')
    .select('*, showcase_item:showcase_items!item_id(*, user:profiles!user_id(id, full_name, avatar_url, badge_level, institution))')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  return { data: (data as ShowcaseHelpLink[]) ?? [], error: error?.message ?? null }
}

export async function createHelpLink(link: {
  item_id: string
  title: string
  url: string
  platform: HelpLinkPlatform
  action_label: string
}) {
  const { data, error } = await supabase
    .from('showcase_help_links')
    .insert(link)
    .select()
    .single()

  return { data: data as ShowcaseHelpLink | null, error: error?.message ?? null }
}

export async function updateHelpLink(
  id: string,
  updates: Partial<Pick<ShowcaseHelpLink, 'title' | 'url' | 'platform' | 'action_label' | 'is_active'>>
) {
  const { data, error } = await supabase
    .from('showcase_help_links')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  return { data: data as ShowcaseHelpLink | null, error: error?.message ?? null }
}

export async function deleteHelpLink(id: string) {
  const { error } = await supabase
    .from('showcase_help_links')
    .delete()
    .eq('id', id)

  return { error: error?.message ?? null }
}

export async function completeHelpLink(linkId: string, helperId: string) {
  const { error } = await supabase
    .from('help_completions')
    .insert({ link_id: linkId, helper_id: helperId })

  return { error: error?.message ?? null }
}

export async function uncompleteHelpLink(linkId: string, helperId: string) {
  const { error } = await supabase
    .from('help_completions')
    .delete()
    .eq('link_id', linkId)
    .eq('helper_id', helperId)

  return { error: error?.message ?? null }
}

export async function fetchUserCompletions(helperId: string, linkIds: string[]) {
  if (linkIds.length === 0) return { data: new Set<string>(), error: null }

  const { data, error } = await supabase
    .from('help_completions')
    .select('link_id')
    .eq('helper_id', helperId)
    .in('link_id', linkIds)

  const ids = new Set((data ?? []).map((row: { link_id: string }) => row.link_id))
  return { data: ids, error: error?.message ?? null }
}
