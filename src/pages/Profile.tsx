import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { getProfile } from '@/lib/api/profiles'
import { fetchPosts } from '@/lib/api/helpPosts'
import { PostCard } from '@/components/board/PostCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Pencil, HandHelping, HelpCircle, Building2, FlaskConical } from 'lucide-react'
import type { Profile as ProfileType, HelpPost } from '@/types/database'

export default function Profile() {
  const { userId } = useParams<{ userId: string }>()
  const { profile: currentUser } = useAuthStore()
  const [profile, setProfile] = useState<ProfileType | null>(null)
  const [posts, setPosts] = useState<HelpPost[]>([])
  const [loading, setLoading] = useState(true)

  const isOwnProfile = currentUser?.id === userId

  useEffect(() => {
    async function load() {
      if (!userId) return
      setLoading(true)
      const [profileResult, postsResult] = await Promise.all([
        getProfile(userId),
        fetchPosts({ limit: 5 }),
      ])
      setProfile(profileResult.data)
      setPosts(postsResult.data.filter((p) => p.author_id === userId))
      setLoading(false)
    }
    load()
  }, [userId])

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p>用户不存在</p>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
              {profile.full_name.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{profile.full_name}</h1>
                <StatusBadge level={profile.badge_level} />
              </div>
              {profile.institution && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {profile.institution}
                </p>
              )}
              {profile.research_field && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <FlaskConical className="h-3.5 w-3.5" />
                  {profile.research_field}
                </p>
              )}
              {profile.bio && (
                <p className="text-sm text-muted-foreground mt-2">{profile.bio}</p>
              )}

              <div className="mt-3 flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <HandHelping className="h-4 w-4 text-accent" />
                  帮助了 {profile.help_given_count} 人
                </span>
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  获得 {profile.help_received_count} 次帮助
                </span>
              </div>
            </div>

            {isOwnProfile && (
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5" render={<Link to="/profile/edit" />}>
                <Pencil className="h-3.5 w-3.5" />
                编辑
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-4">
        <CardHeader className="px-0">
          <CardTitle className="text-lg">发布的需求</CardTitle>
        </CardHeader>

        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">暂无帖子</p>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </div>
  )
}
