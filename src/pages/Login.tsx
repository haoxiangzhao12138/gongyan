import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function Login() {
  const { session, profile, signIn } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (session && profile?.status === 'approved') {
    return <Navigate to="/" replace />
  }

  if (session && profile?.status === 'pending') {
    return <Navigate to="/pending" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await signIn(email, password)

    if (error) {
      toast.error('登录失败', { description: error })
    }

    setLoading(false)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">
            研
          </div>
          <h1 className="text-2xl font-bold tracking-tight">共研 GongYan</h1>
          <p className="text-sm text-muted-foreground">科研小团体的私密互助平台</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>登录</CardTitle>
            <CardDescription>使用你的账号登录共研</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '登录中...' : '登录'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          还没有账号？{' '}
          <Link to="/register" className="text-accent underline-offset-4 hover:underline">
            使用邀请码注册
          </Link>
        </p>
      </div>
    </div>
  )
}
