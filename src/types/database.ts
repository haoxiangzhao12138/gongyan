export type UserStatus = 'pending' | 'approved' | 'rejected'

export type BadgeLevel = 'newcomer' | 'helper' | 'expert' | 'mentor'

export type PostCategory =
  | 'paper_review'
  | 'data_analysis'
  | 'methodology'
  | 'writing'
  | 'resources'
  | 'career'
  | 'other'

export type PostUrgency = 'low' | 'normal' | 'high'

export type PostStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export type NotificationType =
  | 'approval_approved'
  | 'approval_rejected'
  | 'new_response'
  | 'response_accepted'
  | 'new_post'
  | 'system'

export interface Profile {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  bio: string
  research_field: string
  institution: string
  status: UserStatus
  is_admin: boolean
  badge_level: BadgeLevel
  help_given_count: number
  help_received_count: number
  github_username: string | null
  invited_by: string | null
  created_at: string
  updated_at: string
}

export interface Invitation {
  id: string
  code: string
  created_by: string
  used_by: string | null
  used_at: string | null
  expires_at: string
  is_active: boolean
  created_at: string
}

export interface HelpPost {
  id: string
  author_id: string
  title: string
  description: string
  category: PostCategory
  urgency: PostUrgency
  status: PostStatus
  response_count: number
  created_at: string
  updated_at: string
  author?: Profile
}

export interface HelpResponse {
  id: string
  post_id: string
  responder_id: string
  content: string
  is_accepted: boolean
  created_at: string
  updated_at: string
  responder?: Profile
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export interface ActivityLog {
  id: string
  actor_id: string
  action: string
  target_type: string | null
  target_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  actor?: Profile
}

export type ShowcaseItemType = 'paper' | 'github' | 'link'

export interface ShowcaseItem {
  id: string
  user_id: string
  item_type: ShowcaseItemType
  title: string
  url: string
  description: string
  citation: string | null
  stars_count: number | null
  platform_label: string | null
  like_count: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ShowcaseLike {
  id: string
  item_id: string
  user_id: string
  created_at: string
}

export type HelpLinkPlatform =
  | 'github'
  | 'huggingface'
  | 'zhihu'
  | 'xiaohongshu'
  | 'wechat'
  | 'bilibili'
  | 'twitter'
  | 'other'

export interface ShowcaseHelpLink {
  id: string
  item_id: string
  title: string
  url: string
  platform: HelpLinkPlatform
  action_label: string
  completion_count: number
  is_active: boolean
  created_at: string
  updated_at: string
  // joined fields for StarBoard
  showcase_item?: ShowcaseItem & { user?: Profile }
}

export interface HelpCompletion {
  id: string
  link_id: string
  helper_id: string
  created_at: string
}
