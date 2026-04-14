import { useState } from 'react'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toggleShowcaseLike } from '@/lib/api/showcase'
import { cn } from '@/lib/utils'

interface LikeButtonProps {
  itemId: string
  currentUserId: string | undefined
  ownerId: string
  initialLiked: boolean
  initialCount: number
}

export function LikeButton({
  itemId,
  currentUserId,
  ownerId,
  initialLiked,
  initialCount,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, setPending] = useState(false)

  const isOwnItem = currentUserId === ownerId
  const disabled = !currentUserId || isOwnItem || pending

  async function handleClick() {
    if (disabled) return

    // Optimistic update
    const nextLiked = !liked
    setLiked(nextLiked)
    setCount((prev) => prev + (nextLiked ? 1 : -1))
    setPending(true)

    const { error } = await toggleShowcaseLike(itemId, currentUserId!)
    if (error) {
      // Rollback
      setLiked(!nextLiked)
      setCount((prev) => prev + (nextLiked ? -1 : 1))
    }
    setPending(false)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'gap-1.5 text-muted-foreground',
        liked && 'text-rose-500 hover:text-rose-600'
      )}
      disabled={disabled}
      onClick={handleClick}
    >
      <Heart
        className={cn('h-4 w-4', liked && 'fill-current')}
      />
      {count > 0 && <span className="text-xs">{count}</span>}
    </Button>
  )
}
