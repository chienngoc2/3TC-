import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { SessionContext } from '../src/auth/session-context'
import { SubscriptionCard } from '../src/features/subscriptions/components/subscription-card'
import { SubscriptionsPage } from '../src/features/subscriptions/pages/subscriptions-page'
import { getSubscriptionExpiration } from '../src/features/subscriptions/utils/subscription.utils'
import { vietnamDateTime } from '../src/lib/date'
import type { Subscription } from '../src/lib/types'

const subscription: Subscription = {
  id: 'subscription-1',
  planId: 'plan-1',
  disciplineId: 'gym',
  packageTier: 'VIP',
  status: 'ACTIVE',
  createdAt: '2026-10-05T07:30:00Z',
  startDate: '2026-10-01T00:00:00Z',
  endDate: '2026-11-01T00:00:00Z',
  remainingGroupSessions: 999,
  remainingPtSessions: 8,
  remainingSessions: 999,
  hasUnlimitedGymAccess: true,
  assignedCoach: { id: 'coach-1', fullName: 'Nguyễn Văn A' },
  plan: {
    id: 'plan-1',
    name: 'Gym VIP',
    disciplineId: 'gym',
    discipline: { id: 'gym', code: 'GYM', name: 'Gym & Fitness' },
    packageTier: 'VIP',
    price: '600000',
    durationDays: 30,
    groupSessionQuota: 999,
    ptSessionQuota: 12,
    unlimitedGymEntry: true,
    isActive: true,
  },
}

const envelope = (data: unknown) => new Response(JSON.stringify({ success: true, data }))

function renderSubscriptions(item?: Subscription) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
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
        <MemoryRouter initialEntries={['/portal/member/subscriptions']}>
          <Routes>
            <Route
              path="/portal/member/subscriptions"
              element={item ? <SubscriptionCard item={item} /> : <SubscriptionsPage />}
            />
            <Route
              path="/portal/member/checkouts/:checkoutId"
              element={<h1>Thanh toán gói tập</h1>}
            />
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>
    </QueryClientProvider>,
  )
}

describe('subscription expiration', () => {
  it('uses the purchase instant, including month rollover and timezone offsets', () => {
    const item = { ...subscription, packageTier: 'DROP_IN' as const }
    const expiration = getSubscriptionExpiration(item)
    expect(expiration).toBe('2026-10-06T07:30:00.000Z')
    expect(vietnamDateTime(expiration!)).toContain('14:30')
    expect(vietnamDateTime(expiration!)).toContain('06/10/2026')
    expect(getSubscriptionExpiration({ ...item, createdAt: '2026-10-31T23:30:00+07:00' })).toBe(
      '2026-11-01T16:30:00.000Z',
    )
  })

  it.each([
    ['DROP_IN', 'EXPIRED'],
    ['DROP_IN', 'FROZEN'],
    ['PLUS', 'ACTIVE'],
    ['VIP', 'ACTIVE'],
    ['TRIAL', 'ACTIVE'],
  ] as const)('preserves endDate for %s / %s', (packageTier, status) => {
    expect(getSubscriptionExpiration({ ...subscription, packageTier, status })).toBe(
      subscription.endDate,
    )
  })

  it.each(['', 'invalid'])('does not substitute startDate when createdAt is %s', (createdAt) => {
    expect(
      getSubscriptionExpiration({ ...subscription, packageTier: 'DROP_IN', createdAt }),
    ).toBeNull()
  })
})

describe('subscription cards and actions', () => {
  it.each(['PLUS', 'VIP'] as const)(
    'shows unlimited entry without the sentinel group quota for %s',
    (packageTier) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(envelope({ ratePerSession: '100000', amount: '100000' })),
      )
      renderSubscriptions({ ...subscription, packageTier })
      expect(screen.getByText('Vào cửa miễn phí')).toBeTruthy()
      expect(screen.queryByText('Lớp nhóm')).toBeNull()
      expect(screen.queryByText(/999/)).toBeNull()
      expect(
        screen
          .getByRole('progressbar', { name: 'PT · Kèm 1:1 còn lại' })
          .getAttribute('aria-valuenow'),
      ).toBe('8')
      expect(
        screen
          .getByRole('progressbar', { name: 'PT · Kèm 1:1 còn lại' })
          .getAttribute('aria-valuemax'),
      ).toBe('12')
      expect(screen.getByText('Nguyễn Văn A')).toBeTruthy()
    },
  )

  it('keeps an exhausted VIP PT quota visible without a coach', () => {
    renderSubscriptions({ ...subscription, remainingPtSessions: 0, assignedCoach: null })
    expect(screen.getByText('PT · Kèm 1:1')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
    expect(screen.getByText('Vào cửa miễn phí')).toBeTruthy()
  })

  it('shows exhausted group sessions when applicable and respects explicit entitlement false', () => {
    renderSubscriptions({
      ...subscription,
      packageTier: 'PLUS',
      hasUnlimitedGymAccess: false,
      remainingGroupSessions: 0,
      remainingPtSessions: 0,
      assignedCoach: null,
      plan: { ...subscription.plan, groupSessionQuota: 10, ptSessionQuota: 0 },
    })
    expect(screen.queryByText('Vào cửa miễn phí')).toBeNull()
    expect(
      screen.getByRole('progressbar', { name: 'Lớp nhóm còn lại' }).getAttribute('aria-valuenow'),
    ).toBe('0')
    expect(screen.queryByText('PT · Kèm 1:1')).toBeNull()
  })

  it('hides inapplicable zero quotas and shows DROP-IN expiration with its time', () => {
    renderSubscriptions({
      ...subscription,
      packageTier: 'DROP_IN',
      hasUnlimitedGymAccess: false,
      remainingGroupSessions: 0,
      remainingPtSessions: 0,
      assignedCoach: null,
      plan: { ...subscription.plan, groupSessionQuota: 0, ptSessionQuota: 0 },
    })
    expect(screen.queryByText('Lớp nhóm')).toBeNull()
    expect(screen.queryByText('PT · Kèm 1:1')).toBeNull()
    expect(screen.getByText(/14:30.*06\/10\/2026/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Gia hạn' })).toBeNull()
  })

  it('uses the plan entitlement only when the subscription flag is absent', () => {
    renderSubscriptions({ ...subscription, hasUnlimitedGymAccess: undefined, assignedCoach: null })
    expect(screen.getByText('Vào cửa miễn phí')).toBeTruthy()
    expect(screen.queryByText('Lớp nhóm')).toBeNull()
  })

  it('does not invent a purchased total when PT add-ons exceed the plan quota', () => {
    renderSubscriptions({ ...subscription, remainingPtSessions: 15, assignedCoach: null })
    expect(screen.getByText('PT · Kèm 1:1')).toBeTruthy()
    expect(screen.getByText(/15/)).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByText(/\/ 12/)).toBeNull()
  })

  it.each([
    ['ACTIVE', 'Đang sử dụng'],
    ['EXPIRED', 'Hết hạn'],
    ['FROZEN', 'Đang đóng băng'],
  ])('labels status %s clearly', (status, label) => {
    renderSubscriptions({ ...subscription, status, assignedCoach: null })
    expect(screen.getByTitle(status).textContent).toBe(label)
  })

  it.each(['RENEWAL', 'PT_ADDON'] as const)(
    'preserves the %s checkout contract and navigation',
    async (kind) => {
      const fetchMock = vi.fn((url: string) =>
        Promise.resolve(
          envelope(
            url.includes('pt-addon-preview')
              ? { ratePerSession: '100000', amount: '200000' }
              : { checkoutId: 'checkout-1' },
          ),
        ),
      )
      vi.stubGlobal('fetch', fetchMock)
      renderSubscriptions(subscription)
      if (kind === 'PT_ADDON') {
        fireEvent.change(screen.getByLabelText('Mua thêm PT'), { target: { value: '2' } })
        await waitFor(() =>
          expect(
            (screen.getByRole('button', { name: 'Mua thêm buổi PT' }) as HTMLButtonElement)
              .disabled,
          ).toBe(false),
        )
      }
      fireEvent.click(
        screen.getByRole('button', { name: kind === 'RENEWAL' ? 'Gia hạn' : 'Mua thêm buổi PT' }),
      )
      expect(await screen.findByRole('heading', { name: 'Thanh toán gói tập' })).toBeTruthy()
      const checkoutCall = fetchMock.mock.calls.find(([url]) => url.endsWith('/billing/checkouts'))
      expect(checkoutCall).toBeTruthy()
      const init = (checkoutCall as unknown as [string, RequestInit])[1]
      expect(JSON.parse(init.body as string)).toEqual(
        kind === 'RENEWAL'
          ? { kind, subscriptionId: subscription.id }
          : { kind, subscriptionId: subscription.id, addonSessions: 2 },
      )
    },
  )
})

describe('subscriptions page states', () => {
  it('provides an empty state linking to the existing member catalog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(envelope([])))
    renderSubscriptions()
    expect(await screen.findByRole('heading', { name: 'Bạn chưa có gói tập' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Khám phá gói tập' }).getAttribute('href')).toBe(
      '/portal/member/plans',
    )
  })

  it('keeps an API error separate from the empty state and offers retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    renderSubscriptions()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('Bạn chưa có gói tập')).toBeNull()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy()
  })

  it('keeps quotas separate for subscriptions in the same discipline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          envelope(
            url.includes('/disciplines')
              ? []
              : [
                  { ...subscription, assignedCoach: null },
                  {
                    ...subscription,
                    id: 'subscription-2',
                    assignedCoach: null,
                    remainingPtSessions: 3,
                  },
                ],
          ),
        ),
      ),
    )
    renderSubscriptions()
    const cards = await screen.findAllByRole('article')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('8')
    expect(within(cards[1]).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('3')
  })
})
