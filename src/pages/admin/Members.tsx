import { useState, useEffect, useCallback } from 'react'
import { getAllProfiles, rejectUser } from '@/lib/api/profiles'
import { getSystemSetting, setSystemSetting } from '@/lib/api/systemSettings'
import { adminStarAll } from '@/lib/api/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Search,
  UserX,
  Star,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from 'lucide-react'
import { GitHubIcon } from '@/components/shared/GitHubIcon'
import type { Profile } from '@/types/database'

export default function Members() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [autoApprove, setAutoApprove] = useState(false)
  const [autoApproveLoading, setAutoApproveLoading] = useState(false)

  const [confirmRemove, setConfirmRemove] = useState<Profile | null>(null)
  const [removing, setRemoving] = useState(false)

  const [confirmStarAll, setConfirmStarAll] = useState(false)
  const [starring, setStarring] = useState(false)

  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    const { data } = await getAllProfiles()
    setProfiles(data)
    setLoading(false)
  }, [])

  const fetchAutoApprove = useCallback(async () => {
    const { value } = await getSystemSetting<boolean>('auto_approve')
    setAutoApprove(value === true)
  }, [])

  useEffect(() => {
    fetchProfiles()
    fetchAutoApprove()
  }, [fetchProfiles, fetchAutoApprove])

  const handleToggleAutoApprove = async () => {
    setAutoApproveLoading(true)
    const newValue = !autoApprove
    const { error } = await setSystemSetting('auto_approve', newValue)
    if (error) {
      toast.error('设置失败', { description: error })
    } else {
      setAutoApprove(newValue)
      toast.success(newValue ? '免审批已开启' : '免审批已关闭')
    }
    setAutoApproveLoading(false)
  }

  const handleRemove = async () => {
    if (!confirmRemove) return
    setRemoving(true)
    const { error } = await rejectUser(confirmRemove.id)
    if (error) {
      toast.error('操作失败', { description: error })
    } else {
      toast.success('已移除', { description: `${confirmRemove.full_name} 已被移除` })
      fetchProfiles()
    }
    setRemoving(false)
    setConfirmRemove(null)
  }

  const handleStarAll = async () => {
    setStarring(true)
    setConfirmStarAll(false)
    const loadingToast = toast.loading('正在执行全员 Star...')
    const { data, error } = await adminStarAll()
    toast.dismiss(loadingToast)

    if (error) {
      toast.error('全员 Star 失败', { description: error })
    } else if (data) {
      toast.success('全员 Star 完成', {
        description: `尝试 ${data.total_attempted} 个，成功 ${data.total_starred} 个，失败 ${data.failed} 个`,
      })
      if (data.expired_tokens.length > 0) {
        toast.warning(`${data.expired_tokens.length} 位用户 Token 已过期`)
      }
    }
    setStarring(false)
  }

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase()
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.institution ?? '').toLowerCase().includes(q) ||
      (p.github_username ?? '').toLowerCase().includes(q)
    )
  })

  const statusLabel = (status: Profile['status']) => {
    switch (status) {
      case 'approved':
        return '已通过'
      case 'pending':
        return '待审批'
      case 'rejected':
        return '已拒绝'
    }
  }

  const statusVariant = (status: Profile['status']) => {
    switch (status) {
      case 'approved':
        return 'default' as const
      case 'pending':
        return 'outline' as const
      case 'rejected':
        return 'destructive' as const
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">成员管理</h1>
          <p className="text-muted-foreground">管理平台成员、系统设置</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleAutoApprove}
            disabled={autoApproveLoading}
            className="gap-2"
          >
            {autoApprove ? (
              <ToggleRight className="h-4 w-4 text-green-500" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
            免审批: {autoApprove ? '开' : '关'}
          </Button>
          <Button
            size="sm"
            onClick={() => setConfirmStarAll(true)}
            disabled={starring}
            className="gap-2"
          >
            {starring ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Star className="h-4 w-4" />
            )}
            全员 Star
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索姓名、邮箱、机构、GitHub..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p>{search ? '没有找到匹配的成员' : '暂无成员'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">共 {filtered.length} 位成员</p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">姓名</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">邮箱</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">机构</th>
                  <th className="px-4 py-3 text-center font-medium hidden lg:table-cell">互助</th>
                  <th className="px-4 py-3 text-center font-medium hidden lg:table-cell">GitHub</th>
                  <th className="px-4 py-3 text-center font-medium">状态</th>
                  <th className="px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {user.full_name?.charAt(0) || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{user.full_name || '未填写'}</p>
                          <p className="text-xs text-muted-foreground sm:hidden truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground truncate max-w-[200px]">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground truncate max-w-[150px]">
                      {user.institution || '-'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-center">
                      <span className="text-xs text-muted-foreground">
                        {user.help_given_count}/{user.help_received_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-center">
                      {user.github_username ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <GitHubIcon className="h-3 w-3" />
                          {user.github_username}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={statusVariant(user.status)} className="text-xs">
                        {statusLabel(user.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.status !== 'rejected' && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmRemove(user)}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Remove confirmation dialog */}
      <Dialog open={!!confirmRemove} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认移除成员</DialogTitle>
            <DialogDescription>
              确定要移除 <strong>{confirmRemove?.full_name}</strong> 吗？该用户将被标记为已拒绝。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(null)} disabled={removing}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removing}>
              {removing ? '移除中...' : '确认移除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Star all confirmation dialog */}
      <Dialog open={confirmStarAll} onOpenChange={setConfirmStarAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认全员 Star</DialogTitle>
            <DialogDescription>
              将使用所有已绑定 GitHub 的用户的 Token，为平台上所有 GitHub 项目执行 Star 操作。此操作可能需要一些时间。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmStarAll(false)}>
              取消
            </Button>
            <Button onClick={handleStarAll}>
              确认执行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
