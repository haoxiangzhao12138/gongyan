import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { validateInvitationCode, consumeInvitation } from '@/lib/api/invitations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { MailCheck } from 'lucide-react'
import type { Invitation } from '@/types/database'

type Step = 'invite' | 'info' | 'check_email'

export default function Register() {
  const { session, profile, signUp } = useAuthStore()
  const [step, setStep] = useState<Step>('invite')
  const [loading, setLoading] = useState(false)

  const [inviteCode, setInviteCode] = useState('')
  const [validatedInvitation, setValidatedInvitation] = useState<Invitation | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [institution, setInstitution] = useState('')
  const [researchField, setResearchField] = useState('')
  const [bio, setBio] = useState('')

  if (session && profile?.status === 'approved') {
    return <Navigate to="/" replace />
  }

  if (session && profile?.status === 'pending') {
    return <Navigate to="/pending" replace />
  }

  const handleValidateCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { valid, invitation } = await validateInvitationCode(inviteCode.trim())

    if (!valid || !invitation) {
      toast.error('邀请码无效', { description: '请检查邀请码是否正确或已过期' })
      setLoading(false)
      return
    }

    setValidatedInvitation(invitation)
    setStep('info')
    setLoading(false)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validatedInvitation) return

    setLoading(true)

    // Atomically consume invitation BEFORE signup to prevent reuse
    const { consumed, error: consumeError } = await consumeInvitation(validatedInvitation.id)
    if (consumeError || !consumed) {
      toast.error('邀请码已被使用', { description: '该邀请码已失效，请使用新的邀请码' })
      setLoading(false)
      return
    }

    // Store profile info + invitation in signUp metadata
    // so we can retrieve it after email confirmation
    const { error } = await signUp(email, password, fullName, {
      institution,
      research_field: researchField,
      bio,
      invitation_id: validatedInvitation.id,
    })

    if (error) {
      toast.error('注册失败', { description: error })
      setLoading(false)
      return
    }

    setStep('check_email')
    setLoading(false)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">
            研
          </div>
          <h1 className="text-2xl font-bold tracking-tight">加入共研</h1>
          <p className="text-sm text-muted-foreground">
            {step === 'invite' && '请输入邀请码'}
            {step === 'info' && '填写你的信息'}
            {step === 'check_email' && '验证你的邮箱'}
          </p>
        </div>

        {step === 'invite' && (
          <Card>
            <CardHeader>
              <CardTitle>验证邀请码</CardTitle>
              <CardDescription>
                共研是邀请制平台，你需要一个有效的邀请码才能注册
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleValidateCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-code">邀请码</Label>
                  <Input
                    id="invite-code"
                    placeholder="XXXX-XXXX-XXXX"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="text-center font-mono tracking-widest text-lg"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '验证中...' : '验证邀请码'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 'info' && (
          <Card>
            <CardHeader>
              <CardTitle>完善信息</CardTitle>
              <CardDescription>填写基本信息，提交后需要验证邮箱</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-4">
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
                    placeholder="至少 6 位"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">姓名</Label>
                  <Input
                    id="fullName"
                    placeholder="你的真实姓名"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="institution">所属机构</Label>
                  <Input
                    id="institution"
                    placeholder="大学 / 研究所 / 公司"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="researchField">研究方向</Label>
                  <Input
                    id="researchField"
                    placeholder="如：NLP / 计算机视觉 / 生物信息学"
                    value={researchField}
                    onChange={(e) => setResearchField(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">个人简介</Label>
                  <Textarea
                    id="bio"
                    placeholder="简单介绍一下你自己和你的研究"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('invite')}
                    className="flex-1"
                  >
                    返回
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? '注册中...' : '提交注册'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 'check_email' && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                <MailCheck className="h-6 w-6" />
              </div>
              <CardTitle>查收确认邮件</CardTitle>
              <CardDescription>
                我们向 <strong>{email}</strong> 发送了一封确认邮件，请点击邮件中的链接完成验证。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground space-y-1">
                <p>验证邮箱后，你的账号将进入审批流程。</p>
                <p>管理员通过后即可使用共研。</p>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                没收到？请检查垃圾邮件文件夹
              </p>
            </CardContent>
          </Card>
        )}

        {step !== 'check_email' && (
          <p className="text-center text-sm text-muted-foreground">
            已有账号？{' '}
            <Link to="/login" className="text-accent underline-offset-4 hover:underline">
              去登录
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
