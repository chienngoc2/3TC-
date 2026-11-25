import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { SessionContext } from '../src/auth/session-context'
import { PublicPlansPage } from '../src/pages/PublicPages'
const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), { status: 200 })
describe('public plan catalog', () => {
  it('renders only plans returned by the API, with VIP base price identified', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          envelope(
            url.includes('/disciplines')
              ? [{ id: 'yoga', code: 'YOGA', name: 'Yoga' }]
              : [
                  {
                    id: 'plan-1',
                    name: 'Yoga VIP',
                    disciplineId: 'yoga',
                    discipline: { name: 'Yoga' },
                    packageTier: 'VIP',
                    price: '600000',
                    durationDays: 30,
                    groupSessionQuota: 4,
                    ptSessionQuota: 12,
                    isActive: true,
                  },
                ],
          ),
        ),
      ),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <SessionContext.Provider
          value={{
            state: 'anonymous',
            user: null,
            accept: vi.fn(),
            verify: vi.fn(),
            logout: vi.fn(),
          }}
        >
          <MemoryRouter>
            <PublicPlansPage />
          </MemoryRouter>
        </SessionContext.Provider>
      </QueryClientProvider>,
    )
    const elements = await screen.findAllByText('Yoga VIP')
    expect(elements.length).toBeGreaterThan(0)
    expect(screen.getAllByText(/600\.000/).length).toBeGreaterThan(0)
    expect(screen.queryByText('Boxing VIP')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Chọn HLV & báo giá' }).length).toBeGreaterThan(0)
  })


  it('filters out free trial and 0 VND plans completely', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          envelope(
            url.includes('/disciplines')
              ? [{ id: 'gym', code: 'GYM', name: 'Gym' }]
              : [
                  {
                    id: 'trial-1',
                    name: 'Gym Free Trial',
                    disciplineId: 'gym',
                    discipline: { name: 'Gym' },
                    packageTier: 'TRIAL',
                    price: '0',
                    durationDays: 3,
                    groupSessionQuota: 1,
                    ptSessionQuota: 0,
                    isActive: true,
                  },
                  {
                    id: 'zero-plan',
                    name: 'Gym Miễn Phí 0đ',
                    disciplineId: 'gym',
                    discipline: { name: 'Gym' },
                    packageTier: 'PLUS',
                    price: '0',
                    durationDays: 7,
                    groupSessionQuota: 2,
                    ptSessionQuota: 0,
                    isActive: true,
                  },
                  {
                    id: 'paid-plan',
                    name: 'Gym Plus Hội Viên',
                    disciplineId: 'gym',
                    discipline: { name: 'Gym' },
                    packageTier: 'PLUS',
                    price: '500000',
                    durationDays: 30,
                    groupSessionQuota: 10,
                    ptSessionQuota: 0,
                    isActive: true,
                  },
                ],
          ),
        ),
      ),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <SessionContext.Provider
          value={{
            state: 'anonymous',
            user: null,
            accept: vi.fn(),
            verify: vi.fn(),
            logout: vi.fn(),
          }}
        >
          <MemoryRouter>
            <PublicPlansPage />
          </MemoryRouter>
        </SessionContext.Provider>
      </QueryClientProvider>,
    )
    const elements = await screen.findAllByText('Gym Plus Hội Viên')
    expect(elements.length).toBeGreaterThan(0)
    expect(screen.queryByText('Gym Free Trial')).toBeNull()
    expect(screen.queryByText('Gym Miễn Phí 0đ')).toBeNull()
  })
})


