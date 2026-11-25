import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, get, internalReturnTo, readTokens, saveTokens } from '../src/lib/api'
import { checkoutKey, createCheckout } from '../src/lib/checkout'
const envelope = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, statusCode: status, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal('crypto', { randomUUID: () => 'fixed-uuid' })
})
describe('API session and checkout', () => {
  it('refreshes once after a 401 and retries the protected GET with the new access token', async () => {
    saveTokens({ accessToken: 'old', refreshToken: 'refresh-old' })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: false, errorCode: 'UNAUTHORIZED' }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(envelope({ accessToken: 'new', refreshToken: 'refresh-new' }))
      .mockResolvedValueOnce(envelope({ id: 'member-1', role: 'MEMBER' }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(get('/users/profile/me')).resolves.toMatchObject({ id: 'member-1' })
    expect(readTokens()?.refreshToken).toBe('refresh-new')
    expect((fetchMock.mock.calls[1][1] as RequestInit).body).toContain('refresh-old')
    expect((fetchMock.mock.calls[2][1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer new',
    })
  })
  it('preserves credentials when the network is unavailable', async () => {
    saveTokens({ accessToken: 'old', refreshToken: 'refresh-old' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(get('/users/profile/me')).rejects.toMatchObject({
      code: 'NETWORK_UNAVAILABLE',
      status: 0,
    })
    expect(readTokens()?.accessToken).toBe('old')
  })
  it('keeps checkout key stable on retry and sends only permitted fields', async () => {
    const input = { kind: 'NEW_SUBSCRIPTION' as const, planId: 'plan-1' }
    expect(checkoutKey('member-1', input)).toBe(checkoutKey('member-1', input))
    saveTokens({ accessToken: 'access', refreshToken: 'refresh' })
    const fetchMock = vi
      .fn()
      .mockResolvedValue(envelope({ checkoutId: 'order-1', status: 'PENDING_PAYMENT' }, 201))
    vi.stubGlobal('fetch', fetchMock)
    await createCheckout('member-1', input)
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      'Idempotency-Key': 'checkout-fixed-uuid',
    })
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual(input)
  })
  it('rejects external return paths', () => {
    expect(internalReturnTo('//evil.example')).toBe('/portal/member')
    expect(internalReturnTo('/portal/member/bookings?week=2026-09-28')).toContain(
      '/portal/member/bookings',
    )
    expect(new ApiError(409, 'CONFLICT', 'Conflict').code).toBe('CONFLICT')
  })
})
