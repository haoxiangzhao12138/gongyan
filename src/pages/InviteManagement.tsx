import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { generateInvitationCode, getMyInvitations } from '@/lib/api/invitations'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { timeAgo } from '@/components/shared/TimeAgo'
import { toast } from 'sonner'
import { Plus, Copy, Mail, Check, Clock } from 'lucide-react'
import type { Invitation } from '@/types/database'

export default function InviteManagement() {
  const { profile } = useAuthStore()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadInvitations = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const { data } = await getMyInvitations(profile.id)
    setInvitations(data)
    setLoading(false)
  }, [profile])

  useEffect(() => {
    loadInvitations()
  }, [loadInvitations])

  const handleGenerate = async () => {
    if (!profile) return
    setGenerating(true)
    const { code, error } = await generateInvitationCode(profile.id)

    if (error) {
      toast.error('生成失败', { description: error })
      setGenerating(false)
      return
    }

    toast.success('邀请码已生成', { description: code ?? undefined })
    loadInvitations()
    setGenerating(false)
  }

  const handleCopy = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedId(id)
    toast.success('已复制到剪贴板')
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">邀请管理</h1>
          <p className="text-muted-foreground">生成邀请码邀请同行加入共研</p>
        </div>
        <Button onClick={handleGenerate} disabled={generating} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {generating ? '生成中...' : '生成邀请码'}
        </Button>
      </div>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-24 mt-2" />
              </CardContent>
            </Card>
          ))
        ) : invitations.length === 0 ? (
          <EmptyState
            icon={<Mail className="h-8 w-8" />}
            title="暂无邀请码"
            description="点击上方按钮生成邀请码"
          />
        ) : (
          invitations.map((inv) => {
            const isExpired = new Date(inv.expires_at) < new Date()
            const isUsed = !!inv.used_by

            return (
              <Card key={inv.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-base tracking-wider font-medium">
                          {inv.code}
                        </code>
                        {isUsed ? (
                          <Badge className="bg-gray-100 text-gray-600 border-transparent text-xs">
                            已使用
                          </Badge>
                        ) : isExpired ? (
                          <Badge variant="destructive" className="text-xs">
                            已过期
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700 border-transparent text-xs">
                            有效
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>创建于 {timeAgo(inv.created_at)}</span>
                        {!isUsed && !isExpired && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(inv.expires_at).toLocaleDateString('zh-CN')} 过期
                          </span>
                        )}
                      </div>
                    </div>
                    {!isUsed && !isExpired && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(inv.code, inv.id)}
                        className="gap-1.5 shrink-0"
                      >
                        {copiedId === inv.id ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {copiedId === inv.id ? '已复制' : '复制'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
