import type { PostCategory } from '@/types/database'

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
