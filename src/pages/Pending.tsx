import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, LogOut } from 'lucide-react'

export default function Pending() {
  const { session, profile, signOut, refreshProfile } = useAuthStore()

  useEffect(() => {
    if (!profile?.id) return

    const channel = supabase
      .channel(`profile-status:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profile.id}`,
        },
        () => {
          refreshProfile()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id, refreshProfile])

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (profile?.status === 'approved') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">
            研
          </div>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Clock className="h-6 w-6" />
            </div>
            <CardTitle>等待审批</CardTitle>
            <CardDescription>
              你的注册申请已提交，正在等待管理员审批
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-medium">申请信息</p>
              <div className="mt-2 space-y-1 text-muted-foreground">
                <p>姓名：{profile?.full_name || '未填写'}</p>
                <p>邮箱：{profile?.email}</p>
                {profile?.institution && <p>机构：{profile.institution}</p>}
                {profile?.research_field && <p>方向：{profile.research_field}</p>}
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              审批通过后，页面将自动跳转
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
