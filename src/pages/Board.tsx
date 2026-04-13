import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { fetchPosts } from '@/lib/api/helpPosts'
import { PostCard } from '@/components/board/PostCard'
import { CategoryFilter } from '@/components/board/CategoryFilter'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus } from 'lucide-react'
import type { HelpPost, PostCategory } from '@/types/database'

export default function Board() {
  const [posts, setPosts] = useState<HelpPost[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<PostCategory | null>(null)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchPosts({
      category: category ?? undefined,
    })
    setPosts(data)
    setLoading(false)
  }, [category])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">互助看板</h1>
          <p className="text-muted-foreground">发布需求，寻找帮助</p>
        </div>
        <Button className="gap-1.5" render={<Link to="/board/new" />}>
          <Plus className="h-4 w-4" />
          发布需求
        </Button>
      </div>

      <CategoryFilter selected={category} onSelect={setCategory} />

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-lg font-medium">暂无帖子</p>
            <p className="text-sm mt-1">成为第一个发布需求的人吧</p>
            <Button className="mt-4 gap-1.5" render={<Link to="/board/new" />}>
              <Plus className="h-4 w-4" />
              发布需求
            </Button>
          </div>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </div>
  )
}
