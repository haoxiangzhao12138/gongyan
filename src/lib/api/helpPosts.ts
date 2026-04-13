import { supabase } from '@/lib/supabase'
import type { HelpPost, PostCategory, PostStatus } from '@/types/database'

interface FetchPostsOptions {
  category?: PostCategory
  status?: PostStatus
  limit?: number
  offset?: number
}

export async function fetchPosts(options: FetchPostsOptions = {}) {
  const { category, status, limit = 20, offset = 0 } = options

  let query = supabase
    .from('help_posts')
    .select('*, author:profiles!author_id(id, full_name, avatar_url, badge_level, institution)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (category) {
    query = query.eq('category', category)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  return { data: (data as HelpPost[]) ?? [], error: error?.message ?? null }
}

export async function fetchPost(postId: string) {
  const { data, error } = await supabase
    .from('help_posts')
    .select('*, author:profiles!author_id(id, full_name, avatar_url, badge_level, institution, research_field)')
    .eq('id', postId)
    .single()

  return { data: data as HelpPost | null, error: error?.message ?? null }
}

export async function createPost(post: {
  author_id: string
  title: string
  description: string
  category: PostCategory
  urgency: string
}) {
  const { data, error } = await supabase
    .from('help_posts')
    .insert(post)
    .select()
    .single()

  return { data: data as HelpPost | null, error: error?.message ?? null }
}

export async function updatePostStatus(postId: string, status: PostStatus) {
  const { error } = await supabase
    .from('help_posts')
    .update({ status })
    .eq('id', postId)

  return { error: error?.message ?? null }
}

export async function deletePost(postId: string) {
  const { error } = await supabase
    .from('help_posts')
    .delete()
    .eq('id', postId)

  return { error: error?.message ?? null }
}
