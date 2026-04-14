import type { PostCategory, HelpLinkPlatform } from '@/types/database'

export const CATEGORY_CONFIG: Record<PostCategory, { label: string; color: string }> = {
  paper_review: { label: '论文审阅', color: 'bg-blue-100 text-blue-700' },
  data_analysis: { label: '数据分析', color: 'bg-purple-100 text-purple-700' },
  methodology: { label: '方法论', color: 'bg-amber-100 text-amber-700' },
  writing: { label: '写作润色', color: 'bg-green-100 text-green-700' },
  resources: { label: '资源分享', color: 'bg-cyan-100 text-cyan-700' },
  career: { label: '职业发展', color: 'bg-rose-100 text-rose-700' },
  other: { label: '其他', color: 'bg-gray-100 text-gray-700' },
}

export const ALL_CATEGORIES: PostCategory[] = [
  'paper_review',
  'data_analysis',
  'methodology',
  'writing',
  'resources',
  'career',
  'other',
]

/** Display labels for help link platforms */
export const PLATFORM_LABELS: Record<HelpLinkPlatform, string> = {
  github: 'GitHub',
  huggingface: 'HuggingFace',
  zhihu: '知乎',
  xiaohongshu: '小红书',
  wechat: '微信',
  bilibili: 'B站',
  twitter: 'Twitter/X',
  other: '其他',
}

/** Platform options for select dropdowns */
export const PLATFORM_OPTIONS: { value: HelpLinkPlatform; label: string }[] = [
  { value: 'github', label: 'GitHub' },
  { value: 'huggingface', label: 'HuggingFace' },
  { value: 'zhihu', label: '知乎' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'wechat', label: '微信' },
  { value: 'bilibili', label: 'B站' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'other', label: '其他' },
]

/** Default action labels per platform */
export const ACTION_PRESETS: Record<HelpLinkPlatform, string> = {
  github: '点 Star',
  huggingface: '点赞',
  zhihu: '点赞',
  xiaohongshu: '点赞',
  wechat: '点赞',
  bilibili: '三连',
  twitter: '转推',
  other: '点赞',
}
