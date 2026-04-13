import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { fetchPost, updatePostStatus } from '@/lib/api/helpPosts'
import { fetchResponses, createResponse, acceptResponse } from '@/lib/api/helpResponses'
import { CategoryBadge } from '@/components/board/CategoryBadge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { ArrowLeft, Check, Clock, MessageSquare, HandHelping } from 'lucide-react'
import type { HelpPost, HelpResponse, Profile } from '@/types/database'

const STATUS_MAP = {
  open: { label: '待响应', color: 'bg-emerald-100 text-emerald-700' },
  in_progress: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  resolved: { label: '已解决', color: 'bg-gray-100 text-gray-600' },
  closed: { label: '已关闭', color: 'bg-gray-100 text-gray-500' },
}

export default function PostDetail() {
  const { postId } = useParams<{ postId: string }>()
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [post, setPost] = useState<(HelpPost & { author?: Profile }) | null>(null)
  const [responses, setResponses] = useState<(HelpResponse & { responder?: Profile })[]>([])
  const [loading, setLoading] = useState(true)
  const [responseText, setResponseText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    if (!postId) return
    setLoading(true)
    const [postResult, responsesResult] = await Promise.all([
      fetchPost(postId),
      fetchResponses(postId),
    ])
    setPost(postResult.data)
    setResponses(responsesResult.data)
    setLoading(false)
  }, [postId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !postId || !responseText.trim()) return

    setSubmitting(true)
    const { data, error } = await createResponse({
      post_id: postId,
      responder_id: profile.id,
      content: responseText.trim(),
    })

    if (error) {
      toast.error('回复失败', { description: error })
      setSubmitting(false)
      return
    }

    if (data) {
      setResponses((prev) => [...prev, data])
    }

    setResponseText('')
    toast.success('回复成功')

    if (post?.status === 'open') {
      await updatePostStatus(postId, 'in_progress')
      setPost((prev) => prev ? { ...prev, status: 'in_progress' } : prev)
    }

    setSubmitting(false)
  }

  const handleAcceptResponse = async (responseId: string) => {
    if (!postId) return

    const { error } = await acceptResponse(responseId)
    if (error) {
      toast.error('操作失败', { description: error })
      return
    }

    setResponses((prev) =>
      prev.map((r) => (r.id === responseId ? { ...r, is_accepted: true } : r))
    )

    await updatePostStatus(postId, 'resolved')
    setPost((prev) => prev ? { ...prev, status: 'resolved' } : prev)
    toast.success('已标记为已解决')
  }

  const isAuthor = profile?.id === post?.author_id

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-6 w-16" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p>帖子不存在</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/board')}>
          返回看板
        </Button>
      </div>
    )
  }

  const status = STATUS_MAP[post.status]

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/board')}
        className="gap-1.5"
      >
        <ArrowLeft className="h-4 w-4" />
        返回看板
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-xl leading-snug">{post.title}</CardTitle>
            <Badge variant="outline" className={`${status.color} border-transparent shrink-0`}>
              {status.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
            <Link
              to={`/user/${post.author?.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {post.author?.full_name || '匿名'}
            </Link>
            {post.author?.institution && <span>· {post.author.institution}</span>}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(post.created_at).toLocaleString('zh-CN')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CategoryBadge category={post.category} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {post.description}
          </p>

          {isAuthor && post.status === 'open' && (
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await updatePostStatus(post.id, 'closed')
                  setPost((prev) => prev ? { ...prev, status: 'closed' } : prev)
                  toast.success('帖子已关闭')
                }}
              >
                关闭帖子
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          回复 ({responses.length})
        </h2>

        {responses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <HandHelping className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>还没有人回复，来帮帮忙吧</p>
          </div>
        ) : (
          responses.map((response) => (
            <Card key={response.id} className={response.is_accepted ? 'border-accent/50 bg-accent/5' : ''}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Link
                      to={`/user/${response.responder?.id}`}
                      className="font-medium hover:underline"
                    >
                      {response.responder?.full_name || '匿名'}
                    </Link>
                    {response.is_accepted && (
                      <Badge className="bg-accent text-accent-foreground text-xs gap-1">
                        <Check className="h-3 w-3" />
                        已采纳
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(response.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {response.content}
                </p>
                {isAuthor && !response.is_accepted && post.status !== 'resolved' && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAcceptResponse(response.id)}
                      className="gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      采纳此回复
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {post.status !== 'closed' && post.status !== 'resolved' && !isAuthor && (
        <>
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">我可以帮忙</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitResponse} className="space-y-3">
                <Textarea
                  placeholder="描述你能提供的帮助..."
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={4}
                  required
                />
                <Button type="submit" disabled={submitting} className="gap-1.5">
                  <HandHelping className="h-4 w-4" />
                  {submitting ? '提交中...' : '提交回复'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
