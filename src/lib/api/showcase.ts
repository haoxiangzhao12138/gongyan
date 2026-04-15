import { supabase } from '@/lib/supabase'
import type { ShowcaseItem, ShowcaseItemType } from '@/types/database'

export async function fetchShowcaseItems(userId: string) {
  const { data, error } = await supabase
    .from('showcase_items')
    .select('*')
    .eq('user_id', userId)
    .order('item_type')
    .order('sort_order')

  return { data: (data as ShowcaseItem[]) ?? [], error: error?.message ?? null }
}

export async function createShowcaseItem(item: {
  user_id: string
  item_type: ShowcaseItemType
  title: string
  url: string
  description?: string
  citation?: string
  stars_count?: number
  platform_label?: string
  sort_order?: number
  doi?: string
  year?: number
  venue?: string
  citation_count?: number
  openalex_id?: string
  arxiv_id?: string
}) {
  const { data, error } = await supabase
    .from('showcase_items')
    .insert(item)
    .select()
    .single()

  return { data: data as ShowcaseItem | null, error: error?.message ?? null }
}

export async function updateShowcaseItem(
  id: string,
  updates: Partial<
    Pick<
      ShowcaseItem,
      'title' | 'url' | 'description' | 'citation' | 'stars_count' | 'platform_label' | 'sort_order'
    >
  >
) {
  const { data, error } = await supabase
    .from('showcase_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  return { data: data as ShowcaseItem | null, error: error?.message ?? null }
}

export async function deleteShowcaseItem(id: string) {
  const { error } = await supabase
    .from('showcase_items')
    .delete()
    .eq('id', id)

  return { error: error?.message ?? null }
}

export async function toggleShowcaseLike(itemId: string, userId: string) {
  // Check if like already exists
  const { data: existing } = await supabase
    .from('showcase_likes')
    .select('id')
    .eq('item_id', itemId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('showcase_likes')
      .delete()
      .eq('id', existing.id)

    return { liked: false, error: error?.message ?? null }
  }

  const { error } = await supabase
    .from('showcase_likes')
    .insert({ item_id: itemId, user_id: userId })

  return { liked: true, error: error?.message ?? null }
}

export async function fetchUserLikes(userId: string, itemIds: string[]) {
  if (itemIds.length === 0) return { data: new Set<string>(), error: null }

  const { data, error } = await supabase
    .from('showcase_likes')
    .select('item_id')
    .eq('user_id', userId)
    .in('item_id', itemIds)

  const likedIds = new Set((data ?? []).map((row: { item_id: string }) => row.item_id))
  return { data: likedIds, error: error?.message ?? null }
}

export async function batchCreateShowcaseItems(
  items: Array<{
    user_id: string
    item_type: ShowcaseItemType
    title: string
    url: string
    description?: string
    doi?: string
    year?: number
    venue?: string
    citation_count?: number
    openalex_id?: string
    arxiv_id?: string
    sort_order?: number
  }>
) {
  if (items.length === 0) return { data: [] as ShowcaseItem[], error: null }

  const { data, error } = await supabase
    .from('showcase_items')
    .insert(items)
    .select()

  return { data: (data as ShowcaseItem[]) ?? [], error: error?.message ?? null }
}

export async function fetchUserPaperDois(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('showcase_items')
    .select('doi')
    .eq('user_id', userId)
    .eq('item_type', 'paper')
    .not('doi', 'is', null)

  return new Set(
    (data ?? [])
      .map((row: { doi: string | null }) => row.doi)
      .filter((d): d is string => d !== null)
  )
}

/** Update arxiv_id on a showcase item */
export async function updateShowcaseItemArxiv(id: string, arxivId: string) {
  const { error } = await supabase
    .from('showcase_items')
    .update({ arxiv_id: arxivId })
    .eq('id', id)

  return { error: error?.message ?? null }
}
