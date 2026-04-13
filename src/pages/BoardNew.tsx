import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { createPost } from '@/lib/api/helpPosts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { toast } from 'sonner'
import { ALL_CATEGORIES, CATEGORY_CONFIG } from '@/lib/constants'
import { ArrowLeft } from 'lucide-react'
import type { PostCategory } from '@/types/database'

export default function BoardNew() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<PostCategory>('other')
  const [urgency, setUrgency] = useState('normal')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setLoading(true)

    const { data, error } = await createPost({
      author_id: profile.id,
      title,
      description,
      category,
      urgency,
    })

    if (error) {
      toast.error('发布失败', { description: error })
      setLoading(false)
      return
    }

    toast.success('发布成功')
    navigate(`/board/${data?.id}`)
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="gap-1.5"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>发布互助需求</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                placeholder="简要描述你需要的帮助"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">详细描述</Label>
              <Textarea
                id="description"
                placeholder="详细说明你的需求、背景和期望的帮助方式..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>分类</Label>
                <Select value={category} onValueChange={(v) => { if (v) setCategory(v as PostCategory) }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_CONFIG[cat].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>紧急程度</Label>
                <Select value={urgency} onValueChange={(v) => { if (v) setUrgency(v) }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低优先</SelectItem>
                    <SelectItem value="normal">普通</SelectItem>
                    <SelectItem value="high">紧急</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                className="flex-1"
              >
                取消
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? '发布中...' : '发布需求'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
