import { supabase } from '@/lib/supabase'
import type { PaperRepoLink } from '@/types/database'

/** Fetch all repo links for a paper showcase item */
export async function fetchRepoLinksByPaper(paperItemId: string) {
  const { data, error } = await supabase
    .from('paper_repo_links')
    .select('*')
    .eq('paper_item_id', paperItemId)
    .order('created_at')

  return { data: (data as PaperRepoLink[]) ?? [], error: error?.message ?? null }
}

/** Fetch repo links for multiple paper items at once */
export async function fetchRepoLinksByPapers(paperItemIds: string[]) {
  if (paperItemIds.length === 0) return { data: new Map<string, PaperRepoLink[]>(), error: null }

  const { data, error } = await supabase
    .from('paper_repo_links')
    .select('*')
    .in('paper_item_id', paperItemIds)
    .order('created_at')

  const map = new Map<string, PaperRepoLink[]>()
  for (const link of (data as PaperRepoLink[]) ?? []) {
    const existing = map.get(link.paper_item_id) ?? []
    map.set(link.paper_item_id, [...existing, link])
  }

  return { data: map, error: error?.message ?? null }
}

/** Batch create repo links (ignoring duplicates via onConflict) */
export async function batchCreateRepoLinks(
  params: Array<{
    paper_item_id: string
    github_url: string
    repo_name?: string
    stars_count?: number
    source?: 'huggingface' | 'manual'
  }>,
) {
  if (params.length === 0) return { data: [] as PaperRepoLink[], error: null }

  const { data, error } = await supabase
    .from('paper_repo_links')
    .upsert(
      params.map((p) => ({
        paper_item_id: p.paper_item_id,
        github_url: p.github_url,
        repo_name: p.repo_name ?? null,
        stars_count: p.stars_count ?? 0,
        source: p.source ?? 'huggingface',
      })),
      { onConflict: 'paper_item_id,github_url' },
    )
    .select()

  return { data: (data as PaperRepoLink[]) ?? [], error: error?.message ?? null }
}

/** Delete a single repo link */
export async function deleteRepoLink(id: string) {
  const { error } = await supabase
    .from('paper_repo_links')
    .delete()
    .eq('id', id)

  return { error: error?.message ?? null }
}
