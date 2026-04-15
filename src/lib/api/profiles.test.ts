import { describe, it, expect, vi, beforeEach } from 'vitest'

// Chainable supabase mock
function createChainMock() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['from', 'select', 'eq', 'single', 'update', 'order', 'insert']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.single.mockResolvedValue({ data: null, error: null })
  chain.order.mockResolvedValue({ data: [], error: null })
  chain.insert.mockResolvedValue({ error: null })
  return chain
}

let mockChain: ReturnType<typeof createChainMock>

vi.mock('@/lib/supabase', () => {
  mockChain = createChainMock()
  return {
    supabase: {
      from: vi.fn().mockReturnValue(mockChain),
    },
  }
})

let getAllProfiles: typeof import('./profiles').getAllProfiles
let getProfile: typeof import('./profiles').getProfile
let updateProfile: typeof import('./profiles').updateProfile
let getPendingProfiles: typeof import('./profiles').getPendingProfiles
let getProfilesByStatus: typeof import('./profiles').getProfilesByStatus
let approveUser: typeof import('./profiles').approveUser
let rejectUser: typeof import('./profiles').rejectUser

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('./profiles')
  getAllProfiles = mod.getAllProfiles
  getProfile = mod.getProfile
  updateProfile = mod.updateProfile
  getPendingProfiles = mod.getPendingProfiles
  getProfilesByStatus = mod.getProfilesByStatus
  approveUser = mod.approveUser
  rejectUser = mod.rejectUser
})

const mockProfile = {
  id: 'user-1',
  email: 'test@example.com',
  full_name: 'Test User',
  status: 'approved',
  is_admin: false,
  badge_level: 'newcomer',
  help_given_count: 0,
  help_received_count: 0,
  institution: 'Test University',
  research_field: 'CS',
  bio: 'Hello',
  github_username: null,
  google_scholar_url: null,
  avatar_url: null,
  invited_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

// ── getAllProfiles (new) ──

describe('getAllProfiles', () => {
  it('returns all profiles sorted by creation date', async () => {
    const profiles = [mockProfile, { ...mockProfile, id: 'user-2', full_name: 'User 2' }]
    mockChain.order.mockResolvedValueOnce({ data: profiles, error: null })

    const result = await getAllProfiles()

    expect(result.data).toEqual(profiles)
    expect(result.error).toBeNull()
  })

  it('returns empty array when no profiles', async () => {
    mockChain.order.mockResolvedValueOnce({ data: [], error: null })

    const result = await getAllProfiles()

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })

  it('returns empty array with error on failure', async () => {
    mockChain.order.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } })

    const result = await getAllProfiles()

    expect(result.data).toEqual([])
    expect(result.error).toBe('DB error')
  })
})

// ── getProfile ──

describe('getProfile', () => {
  it('returns profile for valid user', async () => {
    mockChain.single.mockResolvedValueOnce({ data: mockProfile, error: null })

    const result = await getProfile('user-1')

    expect(result.data).toEqual(mockProfile)
    expect(result.error).toBeNull()
  })

  it('returns null for non-existent user', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'not found' },
    })

    const result = await getProfile('unknown')

    expect(result.data).toBeNull()
    expect(result.error).toBe('not found')
  })
})

// ── updateProfile ──

describe('updateProfile', () => {
  it('updates and returns profile', async () => {
    const updated = { ...mockProfile, full_name: 'New Name' }
    mockChain.single.mockResolvedValueOnce({ data: updated, error: null })

    const result = await updateProfile('user-1', { full_name: 'New Name' })

    expect(result.data?.full_name).toBe('New Name')
    expect(result.error).toBeNull()
  })

  it('returns error on failure', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied' },
    })

    const result = await updateProfile('user-1', { full_name: 'X' })

    expect(result.data).toBeNull()
    expect(result.error).toBe('permission denied')
  })
})

// ── getPendingProfiles ──

describe('getPendingProfiles', () => {
  it('returns pending profiles', async () => {
    const pending = [{ ...mockProfile, status: 'pending' }]
    mockChain.order.mockResolvedValueOnce({ data: pending, error: null })

    const result = await getPendingProfiles()

    expect(result.data).toEqual(pending)
    expect(result.error).toBeNull()
  })

  it('returns empty array when none pending', async () => {
    mockChain.order.mockResolvedValueOnce({ data: [], error: null })

    const result = await getPendingProfiles()

    expect(result.data).toEqual([])
  })
})

// ── getProfilesByStatus ──

describe('getProfilesByStatus', () => {
  it('returns profiles filtered by status', async () => {
    const approved = [mockProfile]
    mockChain.order.mockResolvedValueOnce({ data: approved, error: null })

    const result = await getProfilesByStatus('approved')

    expect(result.data).toEqual(approved)
    expect(result.error).toBeNull()
  })

  it('handles rejected status', async () => {
    mockChain.order.mockResolvedValueOnce({ data: [], error: null })

    const result = await getProfilesByStatus('rejected')

    expect(result.data).toEqual([])
  })
})

// ── approveUser ──

describe('approveUser', () => {
  it('approves user and sends notification', async () => {
    mockChain.eq.mockResolvedValueOnce({ error: null })
    mockChain.insert.mockResolvedValueOnce({ error: null })

    const result = await approveUser('user-1')

    expect(result).toEqual({ error: null })
  })

  it('returns error on failure', async () => {
    mockChain.eq.mockResolvedValueOnce({ error: { message: 'DB error' } })

    const result = await approveUser('user-1')

    expect(result).toEqual({ error: 'DB error' })
  })
})

// ── rejectUser ──

describe('rejectUser', () => {
  it('rejects user and sends notification', async () => {
    mockChain.eq.mockResolvedValueOnce({ error: null })
    mockChain.insert.mockResolvedValueOnce({ error: null })

    const result = await rejectUser('user-1')

    expect(result).toEqual({ error: null })
  })

  it('returns error on failure', async () => {
    mockChain.eq.mockResolvedValueOnce({ error: { message: 'DB error' } })

    const result = await rejectUser('user-1')

    expect(result).toEqual({ error: 'DB error' })
  })
})
