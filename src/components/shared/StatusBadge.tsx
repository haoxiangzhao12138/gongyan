import { Badge } from '@/components/ui/badge'
import type { BadgeLevel } from '@/types/database'

const BADGE_CONFIG: Record<BadgeLevel, { label: string; color: string }> = {
  newcomer: { label: '新人', color: 'bg-gray-100 text-gray-600' },
  helper: { label: '助手', color: 'bg-blue-100 text-blue-700' },
  expert: { label: '专家', color: 'bg-purple-100 text-purple-700' },
  mentor: { label: '导师', color: 'bg-amber-100 text-amber-700' },
}

export function StatusBadge({ level }: { level: BadgeLevel }) {
  const config = BADGE_CONFIG[level]
  return (
    <Badge variant="outline" className={`${config.color} border-transparent text-xs`}>
      {config.label}
    </Badge>
  )
}
