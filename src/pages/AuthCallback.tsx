import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { updateProfile } from '@/lib/api/profiles'
import { markInvitationUsed } from '@/lib/api/invitations'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Session, User } from '@supabase/supabase-js'

type CallbackStatus = 'loading' | 'success' | 'email_verified' | 'error'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<CallbackStatus>('loading')
  const [statusText, setStatusText] = useState('正在验证...')

  useEffect(() => {
    handleCallback()
  }, [])

  /** Handle GitHub identity linking callback */
  async function handleGitHubLink(session: Session, user: User) {
    const providerToken = session.provider_token
    const providerRefreshToken = session.provider_refresh_token

    const githubIdentity = user.identities?.find(
      (i) => i.provider === 'github'
    )
    const linkedUsername =
      (githubIdentity?.identity_data?.user_name as string) ?? null

    if (providerToken) {
      await supabase.from('github_credentials').upsert({
        user_id: user.id,
        github_token: providerToken,
        ...(providerRefreshToken
          ? { github_refresh_token: providerRefreshToken }
          : {}),
      })

      if (linkedUsername) {
        await updateProfile(user.id, { github_username: linkedUsername })
      }

      await useAuthStore.getState().refreshProfile()
      toast.success('GitHub 绑定成功', {
        description: linkedUsername
          ? `已绑定 @${linkedUsername}`
          : '现在可以在互助广场一键 Star 了',
      })
    } else {
      console.warn(
        'No provider_token after code exchange.',
        'identities:',
        user.identities?.map((i) => i.provider)
      )
      if (linkedUsername) {
        await updateProfile(user.id, { github_username: linkedUsername })
      }
      await useAuthStore.getState().refreshProfile()
      toast.error('GitHub 绑定不完整', {
        description:
          'Token 未获取，Star 功能可能无法使用。请到个人资料页解绑后重新绑定。',
      })
    }

    navigate('/star-board', { replace: true })
  }

  /** Handle registration callback (email confirmation) */
  async function handleRegistration(user: User) {
    const meta = user.user_metadata ?? {}

    if (meta.institution || meta.research_field || meta.bio) {
      await updateProfile(user.id, {
        institution: meta.institution ?? '',
        research_field: meta.research_field ?? '',
        bio: meta.bio ?? '',
      })
    }

    if (meta.invitation_id) {
      await markInvitationUsed(meta.invitation_id, user.id)
    }

    setStatus('success')
    setStatusText('验证成功，正在跳转...')
    navigate('/pending', { replace: true })
  }

  async function handleCallback() {
    const params = new URLSearchParams(window.location.search)
    const flow = params.get('flow')
    const code = params.get('code')

    // Also check hash fragment (some Supabase configs use implicit flow)
    const hashParams = new URLSearchParams(
      window.location.hash.replace('#', '')
    )
    const accessToken = hashParams.get('access_token')
    const hashType = hashParams.get('type')

    let session: Session | null = null

    // Strategy 1: PKCE code exchange
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error('Code exchange failed:', error)
        // PKCE exchange failed — most likely the user opened the email link
        // in a different browser/device where the code_verifier doesn't exist.
        // The email IS verified server-side though, so the user can just log in.
        setStatus('email_verified')
        setStatusText('邮箱已验证成功')
        return
      }
      session = data.session
    }

    // Strategy 2: Hash fragment (implicit flow fallback)
    if (!session && accessToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: hashParams.get('refresh_token') ?? '',
      })
      if (!error && data.session) {
        session = data.session
      }
    }

    // Strategy 3: Existing session in storage
    if (!session) {
      const { data } = await supabase.auth.getSession()
      session = data.session
    }

    // No session obtained by any method
    if (!session) {
      // If this looks like a signup/recovery confirmation (has code or hash type),
      // the email was verified but we can't establish a session here
      if (code || hashType === 'signup' || hashType === 'recovery') {
        setStatus('email_verified')
        setStatusText('邮箱已验证成功')
        return
      }
      setStatus('error')
      setStatusText('验证失败，请重新注册或登录')
      setTimeout(() => navigate('/login', { replace: true }), 3000)
      return
    }

    // Session obtained — route to appropriate handler
    if (flow === 'github-link') {
      await handleGitHubLink(session, session.user)
    } else {
      await handleRegistration(session.user)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        {status === 'loading' && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{statusText}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="text-sm text-muted-foreground">{statusText}</p>
          </>
        )}

        {status === 'email_verified' && (
          <>
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <div className="space-y-1">
              <p className="text-base font-medium">{statusText}</p>
              <p className="text-sm text-muted-foreground">
                请使用你的邮箱和密码登录，完成注册流程。
              </p>
            </div>
            <Button
              className="mt-2 w-full"
              onClick={() => navigate('/login', { replace: true })}
            >
              前往登录
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{statusText}</p>
          </>
        )}
      </div>
    </div>
  )
}
