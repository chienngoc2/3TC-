import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { SessionContext } from '../src/auth/session-context'
import { saveTokens } from '../src/lib/api'
import { CheckoutPage } from '../src/pages/CommercePages'
const socket = vi.hoisted(() => ({
  listeners: {} as Record<string, (event: { checkoutId?: string; status?: string }) => void>,
}))
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: (name: string, listener: (event: { checkoutId?: string; status?: string }) => void) => {
      socket.listeners[name] = listener
    },
    off: vi.fn(),
    disconnect: vi.fn(),
  }),
}))
const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), { status: 200 })
describe('checkout payment confirmation', () => {
  it('treats Socket.IO as an invalidate signal and confirms payment only after GET is FULFILLED', async () => {
    let serverStatus = 'PENDING_PAYMENT'
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        envelope({
          checkoutId: 'order-1',
          kind: 'NEW_SUBSCRIPTION',
          status: serverStatus,
          amount: '300000',
          baseAmount: '300000',
          ptAmount: '0',
          currency: 'VND',
          priceSnapshot: { planName: 'Gym Plus' },
          paymentId: 'ABCDEF1234567890',
          paymentUrl: '/mock-payment',
          expiresAt: '2026-10-01T12:00:00.000Z',
          subscriptionId: null,
          invoiceId: null,
          failureReason: null,
          createdAt: '2026-10-01T11:45:00.000Z',
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    saveTokens({ accessToken: 'access', refreshToken: 'refresh' })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <SessionContext.Provider
          value={{
            state: 'authenticated',
            user: {
              id: 'member-1',
              email: 'member@example.test',
              fullName: 'Member',
              role: 'MEMBER',
            },
            accept: vi.fn(),
            verify: vi.fn(),
            logout: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={['/portal/member/checkouts/order-1']}>
            <Routes>
              <Route path="/portal/member/checkouts/:checkoutId" element={<CheckoutPage />} />
            </Routes>
          </MemoryRouter>
        </SessionContext.Provider>
      </QueryClientProvider>,
    )
    expect(await screen.findByText('PENDING_PAYMENT')).toBeTruthy()
    await waitFor(() => expect(socket.listeners['checkout.updated']).toBeTypeOf('function'))
    socket.listeners['checkout.updated']({ checkoutId: 'order-1', status: 'FULFILLED' })
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1))
    expect(screen.queryByText(/máy chủ xác nhận/)).toBeNull()
    serverStatus = 'FULFILLED'
    socket.listeners['checkout.updated']({ checkoutId: 'order-1', status: 'FULFILLED' })
    expect(await screen.findByText(/máy chủ xác nhận/)).toBeTruthy()
  })
})
