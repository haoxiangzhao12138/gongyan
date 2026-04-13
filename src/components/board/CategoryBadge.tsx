import { Badge } from '@/components/ui/badge'
import type { PostCategory } from '@/types/database'
import { CATEGORY_CONFIG } from '@/lib/constants'

interface CategoryBadgeProps {
  category: PostCategory
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  const config = CATEGORY_CONFIG[category]

  return (
    <Badge variant="outline" className={`${config.color} border-transparent text-xs`}>
      {config.label}
    </Badge>
  )
}
