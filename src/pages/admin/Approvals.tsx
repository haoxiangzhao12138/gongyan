import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getProfilesByStatus, approveUser, rejectUser } from '@/lib/api/profiles'
import { logActivity } from '@/lib/api/activityLog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Check, X, Clock, UserCheck, UserX } from 'lucide-react'
import type { Profile } from '@/types/database'

export default function Approvals() {
  const { profile: adminProfile } = useAuthStore()
  const [tab, setTab] = useState('pending')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProfiles = useCallback(async (status: Profile['status']) => {
    setLoading(true)
    const { data } = await getProfilesByStatus(status)
    setProfiles(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchProfiles(tab as Profile['status'])
  }, [tab, fetchProfiles])

  const handleApprove = async (user: Profile) => {
    const { error } = await approveUser(user.id)
    if (error) {
      toast.error('审批失败', { description: error })
      return
    }

    if (adminProfile) {
      await logActivity(adminProfile.id, 'approve_user', 'profile', user.id, {
        user_name: user.full_name,
      })
    }

    toast.success('已通过', { description: `${user.full_name} 的申请已通过` })
    fetchProfiles('pending')
  }

  const handleReject = async (user: Profile) => {
    const { error } = await rejectUser(user.id)
    if (error) {
      toast.error('操作失败', { description: error })
      return
    }

    if (adminProfile) {
      await logActivity(adminProfile.id, 'reject_user', 'profile', user.id, {
        user_name: user.full_name,
      })
    }

    toast.success('已拒绝', { description: `${user.full_name} 的申请已拒绝` })
    fetchProfiles('pending')
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">审批管理</h1>
        <p className="text-muted-foreground">管理用户注册申请</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">
            <Clock className="mr-1.5 h-3.5 w-3.5" />
            待审批
          </TabsTrigger>
          <TabsTrigger value="approved">
            <UserCheck className="mr-1.5 h-3.5 w-3.5" />
            已通过
          </TabsTrigger>
          <TabsTrigger value="rejected">
            <UserX className="mr-1.5 h-3.5 w-3.5" />
            已拒绝
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : profiles.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <p>暂无{tab === 'pending' ? '待审批' : tab === 'approved' ? '已通过' : '已拒绝'}用户</p>
              </CardContent>
            </Card>
          ) : (
            profiles.map((user) => (
              <ApprovalCard
                key={user.id}
                user={user}
                showActions={tab === 'pending'}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ApprovalCard({
  user,
  showActions,
  onApprove,
  onReject,
}: {
  user: Profile
  showActions: boolean
  onApprove: (user: Profile) => void
  onReject: (user: Profile) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{user.full_name || '未填写姓名'}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </div>
          <Badge
            variant={
              user.status === 'pending'
                ? 'outline'
                : user.status === 'approved'
                ? 'default'
                : 'destructive'
            }
          >
            {user.status === 'pending'
              ? '待审批'
              : user.status === 'approved'
              ? '已通过'
              : '已拒绝'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 text-sm">
          {user.institution && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 shrink-0">机构</span>
              <span>{user.institution}</span>
            </div>
          )}
          {user.research_field && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 shrink-0">方向</span>
              <span>{user.research_field}</span>
            </div>
          )}
          {user.bio && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 shrink-0">简介</span>
              <span className="text-muted-foreground">{user.bio}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-muted-foreground w-16 shrink-0">申请时间</span>
            <span className="text-muted-foreground">
              {new Date(user.created_at).toLocaleString('zh-CN')}
            </span>
          </div>
        </div>

        {showActions && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={() => onApprove(user)} className="gap-1.5">
              <Check className="h-3.5 w-3.5" />
              通过
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onReject(user)}
              className="gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              拒绝
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
