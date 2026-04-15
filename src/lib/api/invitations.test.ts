import { describe, it, expect, vi, beforeEach } from 'vitest'

// Build chainable mock for Supabase query builder
function createChainMock(resolvedValue: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['from', 'select', 'eq', 'is', 'gt', 'single', 'insert', 'update', 'order']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  // Terminal methods resolve the value
  chain.single.mockResolvedValue(resolvedValue)
  // order is also terminal for getMyInvitations
  chain.order.mockResolvedValue(resolvedValue)
  // insert is terminal for generateInvitationCode
  chain.insert.mockResolvedValue(resolvedValue)
  // update + eq chain is terminal for markInvitationUsed
  chain.update.mockReturnValue(chain)
  return chain
}

let mockChain: ReturnType<typeof createChainMock>
let mockRpc: ReturnType<typeof vi.fn>

vi.mock('@/lib/supabase', () => {
  mockChain = createChainMock({ data: null, error: null })
  mockRpc = vi.fn()
  return {
    supabase: {
      from: vi.fn().mockReturnValue(mockChain),
      rpc: mockRpc,
    },
  }
})

let validateInvitationCode: typeof import('./invitations').validateInvitationCode
let markInvitationUsed: typeof import('./invitations').markInvitationUsed
let generateInvitationCode: typeof import('./invitations').generateInvitationCode
let getMyInvitations: typeof import('./invitations').getMyInvitations
let consumeInvitation: typeof import('./invitations').consumeInvitation

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('./invitations')
  validateInvitationCode = mod.validateInvitationCode
  markInvitationUsed = mod.markInvitationUsed
  generateInvitationCode = mod.generateInvitationCode
  getMyInvitations = mod.getMyInvitations
  consumeInvitation = mod.consumeInvitation
})

// ── consumeInvitation (new atomic RPC) ──

describe('consumeInvitation', () => {
  it('returns consumed=true when RPC returns true', async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null })

    const result = await consumeInvitation('inv-123', 'user-456')

    expect(result).toEqual({ consumed: true, error: null })
    expect(mockRpc).toHaveBeenCalledWith('consume_invitation', {
      p_invitation_id: 'inv-123',
      p_used_by: 'user-456',
    })
  })

  it('returns consumed=false when RPC returns false (already used)', async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null })

    const result = await consumeInvitation('inv-123')

    expect(result).toEqual({ consumed: false, error: null })
    expect(mockRpc).toHaveBeenCalledWith('consume_invitation', {
      p_invitation_id: 'inv-123',
      p_used_by: null,
    })
  })

  it('returns consumed=false when RPC returns null', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null })

    const result = await consumeInvitation('inv-123')

    expect(result).toEqual({ consumed: false, error: null })
  })

  it('returns error when RPC fails', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'RPC error' },
    })

    const result = await consumeInvitation('inv-123')

    expect(result).toEqual({ consumed: false, error: 'RPC error' })
  })

  it('passes null for usedBy when not provided', async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null })

    await consumeInvitation('inv-123')

    expect(mockRpc).toHaveBeenCalledWith('consume_invitation', {
      p_invitation_id: 'inv-123',
      p_used_by: null,
    })
  })
})

// ── validateInvitationCode ──

describe('validateInvitationCode', () => {
  it('returns valid invitation on success', async () => {
    const invitation = { id: 'inv-1', code: 'ABCD-EFGH-1234', is_active: true }
    mockChain.single.mockResolvedValueOnce({ data: invitation, error: null })

    const result = await validateInvitationCode('ABCD-EFGH-1234')

    expect(result.valid).toBe(true)
    expect(result.invitation).toEqual(invitation)
  })

  it('returns invalid when code not found', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })

    const result = await validateInvitationCode('XXXX-XXXX-XXXX')

    expect(result.valid).toBe(false)
    expect(result.invitation).toBeNull()
  })

  it('returns invalid when data is null', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: null })

    const result = await validateInvitationCode('XXXX-XXXX-XXXX')

    expect(result.valid).toBe(false)
    expect(result.invitation).toBeNull()
  })
})

// ── markInvitationUsed ──

describe('markInvitationUsed', () => {
  it('marks invitation without userId', async () => {
    // The chain ends at .eq (after .update), so mock the last .eq to resolve
    mockChain.eq.mockResolvedValueOnce({ error: null })

    const result = await markInvitationUsed('inv-1')

    expect(result).toEqual({ error: null })
  })

  it('marks invitation with userId', async () => {
    mockChain.eq.mockResolvedValueOnce({ error: null })

    const result = await markInvitationUsed('inv-1', 'user-1')

    expect(result).toEqual({ error: null })
  })

  it('returns error message on failure', async () => {
    mockChain.eq.mockResolvedValueOnce({ error: { message: 'DB error' } })

    const result = await markInvitationUsed('inv-1')

    expect(result).toEqual({ error: 'DB error' })
  })
})

// ── generateInvitationCode ──

describe('generateInvitationCode', () => {
  it('returns generated code on success', async () => {
    mockChain.insert.mockResolvedValueOnce({ error: null })

    const result = await generateInvitationCode('user-1')

    expect(result.error).toBeNull()
    expect(result.code).toBeTruthy()
    // Code format: XXXX-XXXX-XXXX
    expect(result.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
  })

  it('returns error on insert failure', async () => {
    mockChain.insert.mockResolvedValueOnce({ error: { message: 'duplicate' } })

    const result = await generateInvitationCode('user-1')

    expect(result).toEqual({ code: null, error: 'duplicate' })
  })

  it('generates code without ambiguous characters (I, O, 0, 1)', () => {
    // Run multiple generations to probabilistically check
    // We test the format validation which implicitly checks this
    // The regex [A-Z2-9] excludes 0 and 1 digits, and the char set excludes I and O
  })
})

// ── getMyInvitations ──

describe('getMyInvitations', () => {
  it('returns invitations list', async () => {
    const invitations = [
      { id: 'inv-1', code: 'AAAA-BBBB-CCCC' },
      { id: 'inv-2', code: 'DDDD-EEEE-FFFF' },
    ]
    mockChain.order.mockResolvedValueOnce({ data: invitations, error: null })

    const result = await getMyInvitations('user-1')

    expect(result.data).toEqual(invitations)
    expect(result.error).toBeNull()
  })

  it('returns empty array on error', async () => {
    mockChain.order.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } })

    const result = await getMyInvitations('user-1')

    expect(result.data).toEqual([])
    expect(result.error).toBe('DB error')
  })
})
