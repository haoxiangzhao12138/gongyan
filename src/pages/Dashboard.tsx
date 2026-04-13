import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { fetchPosts } from '@/lib/api/helpPosts'
import { getRecentActivity } from '@/lib/api/activityLog'
import { PostCard } from '@/components/board/PostCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, MessageSquareText, Mail, User } from 'lucide-react'
import { timeAgo } from '@/components/shared/TimeAgo'
import type { HelpPost, ActivityLog } from '@/types/database'

export default function Dashboard() {
  const { profile } = useAuthStore()
  const [recentPosts, setRecentPosts] = useState<HelpPost[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [postsResult, activityResult] = await Promise.all([
      fetchPosts({ limit: 5 }),
      profile?.is_admin ? getRecentActivity(10) : Promise.resolve({ data: [], error: null }),
    ])
    setRecentPosts(postsResult.data)
    setActivities(activityResult.data)
    setLoading(false)
  }, [profile?.is_admin])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            你好，{profile?.full_name || '同学'}
          </h1>
          <p className="text-muted-foreground">欢迎回到共研</p>
        </div>
        {profile && <StatusBadge level={profile.badge_level} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction
          to="/board/new"
          icon={<Plus className="h-5 w-5" />}
          label="发布需求"
          description="寻找帮助"
        />
        <QuickAction
          to="/board"
          icon={<MessageSquareText className="h-5 w-5" />}
          label="互助看板"
          description="浏览帖子"
        />
        <QuickAction
          to="/invites"
          icon={<Mail className="h-5 w-5" />}
          label="邀请好友"
          description="发送邀请码"
        />
        <QuickAction
          to={`/user/${profile?.id}`}
          icon={<User className="h-5 w-5" />}
          label="个人主页"
          description="查看资料"
        />
      </div>

      <Separator />

      <div className="space-y-4">
        <CardHeader className="px-0">
          <CardTitle className="text-lg">最近帖子</CardTitle>
        </CardHeader>

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))
        ) : recentPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">暂无帖子</p>
        ) : (
          recentPosts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>

      {profile?.is_admin && activities.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <CardHeader className="px-0">
              <CardTitle className="text-lg">管理员动态</CardTitle>
            </CardHeader>
            {activities.map((activity) => (
              <Card key={activity.id}>
                <CardContent className="py-3 flex items-center gap-3 text-sm">
                  <div className="flex-1">
                    <span className="font-medium">
                      {(activity.actor as unknown as { full_name: string })?.full_name || '管理员'}
                    </span>
                    <span className="text-muted-foreground ml-1">
                      {activity.action === 'approve_user' ? '通过了' : '拒绝了'}
                    </span>
                    <span className="font-medium ml-1">
                      {(activity.metadata as { user_name?: string })?.user_name || '用户'}
                    </span>
                    <span className="text-muted-foreground ml-1">的申请</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {timeAgo(activity.created_at)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function QuickAction({
  to,
  icon,
  label,
  description,
}: {
  to: string
  icon: React.ReactNode
  label: string
  description: string
}) {
  return (
    <Link to={to}>
      <Card className="transition-colors hover:border-accent/50 hover:shadow-sm">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            {icon}
          </div>
          <div>
            <CardTitle className="text-sm">{label}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
