import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ──

const mockRpc = vi.fn()
const mockFrom = vi.fn()
const mockGetSession = vi.fn()
const mockGetUser = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockSignUp = vi.fn()
const mockSignOut = vi.fn()
const mockLinkIdentity = vi.fn()
const mockUnlinkIdentity = vi.fn()
const mockOnAuthStateChange = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      linkIdentity: (...args: unknown[]) => mockLinkIdentity(...args),
      unlinkIdentity: (...args: unknown[]) => mockUnlinkIdentity(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}))

// Stub window.location.origin used by signUp / linkGitHub
vi.stubGlobal('window', { location: { origin: 'https://test.example.com' } })

// ── Helpers ──

function chainable(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
  chain.upsert = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(resolvedValue)
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(resolvedValue).then(resolve)
  return chain
}

function resetStore() {
  // Zustand stores are singletons — reset state between tests
  const { useAuthStore } = require('./authStore') as typeof import('./authStore')
  useAuthStore.setState({ session: null, profile: null, loading: true })
  return useAuthStore
}

// ── Tests ──

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

describe('authStore', () => {
  describe('interface shape', () => {
    it('does not expose HuggingFace methods', async () => {
      const { useAuthStore } = await import('./authStore')
      const state = useAuthStore.getState()

      expect(state).not.toHaveProperty('linkHuggingFace')
      expect(state).not.toHaveProperty('unlinkHuggingFace')
      expect(state).not.toHaveProperty('getHfToken')
    })

    it('exposes GitHub methods', async () => {
      const { useAuthStore } = await import('./authStore')
      const state = useAuthStore.getState()

      expect(state).toHaveProperty('linkGitHub')
      expect(state).toHaveProperty('unlinkGitHub')
    })
  })

  describe('initialize', () => {
    it('loads session and profile on init', async () => {
      const fakeSession = {
        user: { id: 'user-1' },
      }
      const fakeProfile = { id: 'user-1', full_name: 'Test' }

      mockGetSession.mockResolvedValue({ data: { session: fakeSession } })

      const profileChain = chainable({ data: fakeProfile, error: null })
      mockFrom.mockReturnValue(profileChain)
      mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })

      const { useAuthStore } = await import('./authStore')
      await useAuthStore.getState().initialize()

      expect(mockGetSession).toHaveBeenCalled()
      expect(mockFrom).toHaveBeenCalledWith('profiles')
      expect(useAuthStore.getState().loading).toBe(false)
    })

    it('calls save_github_credentials RPC on USER_UPDATED with provider_token', async () => {
      let authCallback: ((event: string, session: unknown) => void) | null = null

      mockGetSession.mockResolvedValue({ data: { session: null } })
      mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
        authCallback = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      })

      const { useAuthStore } = await import('./authStore')
      await useAuthStore.getState().initialize()

      // Simulate USER_UPDATED event with provider_token
      const updatedSession = {
        user: {
          id: 'user-1',
          identities: [
            { provider: 'github', identity_data: { user_name: 'octocat' } },
          ],
        },
        provider_token: 'gho_abc123',
        provider_refresh_token: 'ghr_xyz789',
      }

      mockRpc.mockResolvedValue({ error: null })
      const profileUpdateChain = chainable({ data: null, error: null })
      mockFrom.mockReturnValue(profileUpdateChain)

      await authCallback!('USER_UPDATED', updatedSession)

      // Verify RPC was called with the correct args
      expect(mockRpc).toHaveBeenCalledWith('save_github_credentials', {
        p_github_token: 'gho_abc123',
        p_github_refresh_token: 'ghr_xyz789',
      })
    })

    it('logs error when RPC fails but does not throw', async () => {
      let authCallback: ((event: string, session: unknown) => void) | null = null

      mockGetSession.mockResolvedValue({ data: { session: null } })
      mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
        authCallback = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { useAuthStore } = await import('./authStore')
      await useAuthStore.getState().initialize()

      const updatedSession = {
        user: { id: 'user-1', identities: [] },
        provider_token: 'gho_abc123',
        provider_refresh_token: null,
      }

      mockRpc.mockResolvedValue({ error: { message: 'RPC failed' } })
      const profileChain = chainable({ data: null, error: null })
      mockFrom.mockReturnValue(profileChain)

      await authCallback!('USER_UPDATED', updatedSession)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save GitHub credentials:',
        'RPC failed'
      )

      consoleSpy.mockRestore()
    })
  })

  describe('linkGitHub', () => {
    it('deletes old credentials before re-linking', async () => {
      const deleteChain = chainable({ error: null })
      mockFrom.mockReturnValue(deleteChain)

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-1',
            identities: [
              { provider: 'github', id: 'gh-identity-1' },
            ],
          },
        },
      })
      mockUnlinkIdentity.mockResolvedValue({ error: null })
      mockLinkIdentity.mockResolvedValue({ error: null })

      const { useAuthStore } = await import('./authStore')
      const result = await useAuthStore.getState().linkGitHub()

      // Should unlink existing identity
      expect(mockUnlinkIdentity).toHaveBeenCalledWith({
        provider: 'github',
        id: 'gh-identity-1',
      })

      // Should delete old credentials
      expect(mockFrom).toHaveBeenCalledWith('github_credentials')

      // Should call linkIdentity with correct params
      expect(mockLinkIdentity).toHaveBeenCalledWith({
        provider: 'github',
        options: {
          redirectTo: 'https://test.example.com/auth/callback?flow=github-link',
          scopes: 'public_repo',
        },
      })

      expect(result).toEqual({ error: null })
    })

    it('skips unlink when no GitHub identity exists', async () => {
      const deleteChain = chainable({ error: null })
      mockFrom.mockReturnValue(deleteChain)

      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-1', identities: [] } },
      })
      mockLinkIdentity.mockResolvedValue({ error: null })

      const { useAuthStore } = await import('./authStore')
      await useAuthStore.getState().linkGitHub()

      expect(mockUnlinkIdentity).not.toHaveBeenCalled()
      expect(mockLinkIdentity).toHaveBeenCalled()
    })

    it('returns error message on failure', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-1', identities: [] } },
      })

      const deleteChain = chainable({ error: null })
      mockFrom.mockReturnValue(deleteChain)

      mockLinkIdentity.mockResolvedValue({
        error: { message: 'Provider not enabled' },
      })

      const { useAuthStore } = await import('./authStore')
      const result = await useAuthStore.getState().linkGitHub()

      expect(result).toEqual({ error: 'Provider not enabled' })
    })
  })

  describe('unlinkGitHub', () => {
    it('unlinks identity, deletes credentials, and clears profile github_username', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-1',
            identities: [{ provider: 'github', id: 'gh-identity-1' }],
          },
        },
      })
      mockUnlinkIdentity.mockResolvedValue({ error: null })
      mockGetSession.mockResolvedValue({ data: { session: null } })
      mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })

      const profileChain = chainable({ data: null, error: null })
      mockFrom.mockReturnValue(profileChain)

      const { useAuthStore } = await import('./authStore')
      // Set session so unlinkGitHub can access user id
      useAuthStore.setState({
        session: { user: { id: 'user-1' } } as never,
      })

      const result = await useAuthStore.getState().unlinkGitHub()

      expect(mockUnlinkIdentity).toHaveBeenCalled()
      expect(mockFrom).toHaveBeenCalledWith('github_credentials')
      expect(mockFrom).toHaveBeenCalledWith('profiles')
      expect(result).toEqual({ error: null })
    })
  })

  describe('signIn', () => {
    it('returns null error on success', async () => {
      mockSignInWithPassword.mockResolvedValue({ error: null })

      const { useAuthStore } = await import('./authStore')
      const result = await useAuthStore.getState().signIn('a@b.com', 'pass')

      expect(result).toEqual({ error: null })
    })

    it('returns error message on failure', async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: 'Invalid credentials' },
      })

      const { useAuthStore } = await import('./authStore')
      const result = await useAuthStore.getState().signIn('a@b.com', 'wrong')

      expect(result).toEqual({ error: 'Invalid credentials' })
    })
  })

  describe('signOut', () => {
    it('clears session and profile', async () => {
      mockSignOut.mockResolvedValue({ error: null })

      const { useAuthStore } = await import('./authStore')
      useAuthStore.setState({
        session: { user: { id: 'user-1' } } as never,
        profile: { id: 'user-1' } as never,
      })

      await useAuthStore.getState().signOut()

      expect(useAuthStore.getState().session).toBeNull()
      expect(useAuthStore.getState().profile).toBeNull()
    })
  })
})
