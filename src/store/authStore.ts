import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'
import { supabase } from '@/lib/supabase'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    fullName: string,
    metadata?: Record<string, string>
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  linkGitHub: () => Promise<{ error: string | null }>
  unlinkGitHub: () => Promise<{ error: string | null }>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  loading: true,

  initialize: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    set({ session })

    if (session?.user) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      set({ profile: data as Profile | null })
    }

    set({ loading: false })

    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ session })

      if (session?.user) {
        // After GitHub identity linking, capture provider_token
        // Implicit flow fires SIGNED_IN; PKCE fires USER_UPDATED
        if (
          (event === 'USER_UPDATED' || event === 'SIGNED_IN') &&
          session.provider_token
        ) {
          const githubIdentity = session.user.identities?.find(
            (i) => i.provider === 'github'
          )
          const githubUsername =
            (githubIdentity?.identity_data?.user_name as string) ?? null

          // Save token via SECURITY DEFINER RPC (no SELECT policy needed)
          const { error: credErr } = await supabase.rpc('save_github_credentials', {
            p_github_token: session.provider_token,
            p_github_refresh_token: session.provider_refresh_token ?? null,
          })

          if (credErr) {
            console.error('Failed to save GitHub credentials:', credErr.message)
          }

          // Save public username to profiles
          const { error: profileErr } = await supabase
            .from('profiles')
            .update({ github_username: githubUsername })
            .eq('id', session.user.id)

          if (profileErr) {
            console.error('Failed to update GitHub username:', profileErr.message)
          }
        }

        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        set({ profile: data as Profile | null })
      } else {
        set({ profile: null })
      }
    })
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error: error?.message ?? null }
  },

  signUp: async (email, password, fullName, metadata) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, ...metadata },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error: error?.message ?? null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, profile: null })
  },

  refreshProfile: async () => {
    const session = get().session
    if (!session?.user) return

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    set({ profile: data as Profile | null })
  },

  linkGitHub: async () => {
    // First check if GitHub identity already exists and unlink it
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const githubIdentity = user?.identities?.find(
      (i) => i.provider === 'github'
    )
    if (githubIdentity) {
      await supabase.auth.unlinkIdentity(githubIdentity)
    }

    // Delete stale credentials so the new OAuth flow writes fresh ones
    if (user) {
      await supabase
        .from('github_credentials')
        .delete()
        .eq('user_id', user.id)
    }

    const { error } = await supabase.auth.linkIdentity({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?flow=github-link`,
        scopes: 'public_repo',
      },
    })
    return { error: error?.message ?? null }
  },

  unlinkGitHub: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Clear DB FIRST — before unlinkIdentity triggers onAuthStateChange
    // which would re-fetch the profile and restore stale github_username
    const session = get().session
    if (session?.user) {
      await supabase
        .from('github_credentials')
        .delete()
        .eq('user_id', session.user.id)

      await supabase
        .from('profiles')
        .update({ github_username: null })
        .eq('id', session.user.id)
    }

    // Now unlink the identity (triggers onAuthStateChange, but DB is already clean)
    const githubIdentity = user?.identities?.find(
      (i) => i.provider === 'github'
    )
    if (githubIdentity) {
      const { error } = await supabase.auth.unlinkIdentity(githubIdentity)
      if (error) return { error: error.message }
    }

    await get().refreshProfile()
    return { error: null }
  },

}))
