import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { LikeButton } from './LikeButton'
import type { ShowcaseItem } from '@/types/database'

interface ShowcaseLinkCardProps {
  item: ShowcaseItem
  currentUserId: string | undefined
  liked: boolean
}

export function ShowcaseLinkCard({ item, currentUserId, liked }: ShowcaseLinkCardProps) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium hover:underline"
              >
                {item.title}
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </a>
              {item.platform_label && (
                <Badge variant="secondary">{item.platform_label}</Badge>
              )}
            </div>
            {item.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {item.description}
              </p>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1">
          <LikeButton
            itemId={item.id}
            currentUserId={currentUserId}
            ownerId={item.user_id}
            initialLiked={liked}
            initialCount={item.like_count}
          />
        </div>
      </CardContent>
    </Card>
  )
}
