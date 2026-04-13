import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from './CategoryBadge'
import { MessageSquare, Clock } from 'lucide-react'
import type { HelpPost, Profile } from '@/types/database'

interface PostCardProps {
  post: HelpPost & { author?: Profile }
}

const URGENCY_MAP = {
  low: { label: '低优先', variant: 'outline' as const },
  normal: { label: '普通', variant: 'secondary' as const },
  high: { label: '紧急', variant: 'destructive' as const },
}

const STATUS_MAP = {
  open: { label: '待响应', color: 'bg-emerald-100 text-emerald-700' },
  in_progress: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  resolved: { label: '已解决', color: 'bg-gray-100 text-gray-600' },
  closed: { label: '已关闭', color: 'bg-gray-100 text-gray-500' },
}

export function PostCard({ post }: PostCardProps) {
  const urgency = URGENCY_MAP[post.urgency]
  const status = STATUS_MAP[post.status]

  return (
    <Link to={`/board/${post.id}`}>
      <Card className="transition-colors hover:border-accent/50 hover:shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-semibold leading-snug line-clamp-2">
              {post.title}
            </h3>
            <Badge variant="outline" className={`${status.color} border-transparent text-xs shrink-0`}>
              {status.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {post.description}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <CategoryBadge category={post.category} />
            {post.urgency !== 'normal' && (
              <Badge variant={urgency.variant} className="text-xs">
                {urgency.label}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span>{post.author?.full_name || '匿名'}</span>
              {post.author?.institution && (
                <span className="text-muted-foreground/50">
                  · {post.author.institution}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {post.response_count}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTimeAgo(post.created_at)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date

  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`

  return new Date(dateStr).toLocaleDateString('zh-CN')
}
