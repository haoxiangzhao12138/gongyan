import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { updateProfile } from '@/lib/api/profiles'
import { markInvitationUsed } from '@/lib/api/invitations'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { Session, User } from '@supabase/supabase-js'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('正在验证...')

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
      // Save token to credentials table (not readable by other users)
      await supabase.from('github_credentials').upsert({
        user_id: user.id,
        github_token: providerToken,
        ...(providerRefreshToken
          ? { github_refresh_token: providerRefreshToken }
          : {}),
      })

      // Save public username to profiles
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
      // Still save username if available
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

    setStatus('验证成功，正在跳转...')
    navigate('/pending', { replace: true })
  }

  async function handleCallback() {
    const params = new URLSearchParams(window.location.search)
    const flow = params.get('flow')
    const code = params.get('code')

    // Step 1: Obtain session (PKCE code exchange or fallback)
    let session: Session | null = null

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error('Code exchange failed:', error)
        setStatus('验证失败，请重新操作')
        setTimeout(() => navigate('/login', { replace: true }), 2000)
        return
      }
      session = data.session
    } else {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        setStatus('验证失败，请重新注册或登录')
        setTimeout(() => navigate('/login', { replace: true }), 2000)
        return
      }
      session = data.session
    }

    // Step 2: Route to appropriate handler
    if (flow === 'github-link') {
      await handleGitHubLink(session, session.user)
    } else {
      await handleRegistration(session.user)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">{status}</p>
      </div>
    </div>
  )
}
