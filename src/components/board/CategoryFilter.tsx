import { Button } from '@/components/ui/button'
import type { PostCategory } from '@/types/database'
import { ALL_CATEGORIES, CATEGORY_CONFIG } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface CategoryFilterProps {
  selected: PostCategory | null
  onSelect: (category: PostCategory | null) => void
}

export function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={selected === null ? 'default' : 'outline'}
        size="sm"
        onClick={() => onSelect(null)}
        className={cn(selected === null && 'bg-primary')}
      >
        全部
      </Button>
      {ALL_CATEGORIES.map((cat) => (
        <Button
          key={cat}
          variant={selected === cat ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect(cat)}
          className={cn(selected === cat && 'bg-primary')}
        >
          {CATEGORY_CONFIG[cat].label}
        </Button>
      ))}
    </div>
  )
}
