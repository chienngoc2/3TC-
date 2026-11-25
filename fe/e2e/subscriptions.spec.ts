import { expect, test } from '@playwright/test'
import type { Subscription } from '../src/lib/types'

test.use({ baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173' })

const gym = { id: 'gym', code: 'GYM', name: 'Gym & Fitness' }
const yoga = { id: 'yoga', code: 'YOGA', name: 'Yoga & Meditation' }

function makeSubscription(id: string, overrides: Partial<Subscription> = {}): Subscription {
  return {
    id,
    planId: `plan-${id}`,
    disciplineId: gym.id,
    packageTier: 'PLUS',
    status: 'ACTIVE',
    createdAt: '2026-10-05T07:30:00Z',
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2026-11-01T00:00:00Z',
    remainingGroupSessions: 999,
    remainingPtSessions: 0,
    remainingSessions: 999,
    hasUnlimitedGymAccess: true,
    plan: {
      id: `plan-${id}`,
      name: 'Gym Plus',
      disciplineId: gym.id,
      discipline: gym,
      packageTier: 'PLUS',
      price: '500000',
      durationDays: 30,
      groupSessionQuota: 999,
      ptSessionQuota: 0,
      unlimitedGymEntry: true,
      isActive: true,
    },
    ...overrides,
  }
}

const plus = makeSubscription('plus')
const subscriptions = [
  plus,
  makeSubscription('vip', {
    packageTier: 'VIP',
    remainingPtSessions: 8,
    assignedCoach: { id: 'coach-1', fullName: 'Nguyễn Văn A' },
    plan: { ...plus.plan, id: 'plan-vip', name: 'Gym VIP', packageTier: 'VIP', ptSessionQuota: 12 },
  }),
  makeSubscription('drop-in', {
    packageTier: 'DROP_IN',
    hasUnlimitedGymAccess: false,
    remainingGroupSessions: 1,
    plan: {
      ...plus.plan,
      id: 'plan-drop-in',
      name: 'Gym Drop-in',
      packageTier: 'DROP_IN',
      groupSessionQuota: 1,
    },
  }),
  makeSubscription('yoga-expired', {
    status: 'EXPIRED',
    disciplineId: yoga.id,
    hasUnlimitedGymAccess: false,
    remainingGroupSessions: 0,
    plan: {
      ...plus.plan,
      id: 'plan-yoga',
      name: 'Yoga Plus',
      disciplineId: yoga.id,
      discipline: yoga,
      groupSessionQuota: 12,
    },
  }),
  makeSubscription('frozen', {
    status: 'FROZEN',
    plan: { ...plus.plan, id: 'plan-frozen', name: 'Gym Plus đóng băng' },
  }),
]

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }),
  )
  await page.addInitScript(() => {
    localStorage.setItem(
      'sportscenter.member.tokens',
      JSON.stringify({ accessToken: 'test-access', refreshToken: 'test-refresh' }),
    )
    localStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 'member-1',
        fullName: 'Nguyễn Minh Anh',
        email: 'member@example.test',
        role: 'MEMBER',
      }),
    )
  })
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith('/memberships/subscriptions')
      ? subscriptions
      : path.endsWith('/disciplines')
        ? [gym, yoga]
        : path.includes('/pt-addon-preview')
          ? { amount: '150000', ratePerSession: '150000' }
          : {
              id: 'member-1',
              fullName: 'Nguyễn Minh Anh',
              email: 'member@example.test',
              role: 'MEMBER',
            }
    await route.fulfill({ json: { success: true, data } })
  })
})

for (const [label, width, columns] of [
  ['desktop', 1440, 3],
  ['tablet', 768, 1],
  ['mobile', 390, 1],
  ['small-mobile', 320, 1],
] as const) {
  test(`subscription benefits and layout on ${label}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/portal/member/subscriptions')
    await expect(page.getByRole('heading', { name: 'Gói tập của tôi' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Gói tập của tôi' })).toBeInViewport()
    const cards = page.getByRole('article')
    await expect(cards).toHaveCount(5)
    const vip = page.getByRole('article', { name: 'Gym VIP', exact: true })
    await expect(vip.getByText('Vào cửa miễn phí')).toBeVisible()
    await expect(vip.getByText('Lớp nhóm')).toHaveCount(0)
    await expect(vip.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '8')
    await expect(vip.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '12')
    await expect(vip.getByText('Nguyễn Văn A')).toBeVisible()
    await expect(
      page.getByRole('article', { name: 'Gym Drop-in' }).getByText(/14:30.*06\/10\/2026/),
    ).toBeVisible()
    await expect(page.getByTitle('EXPIRED')).toHaveText('Hết hạn')
    await expect(page.getByTitle('FROZEN')).toHaveText('Đang đóng băng')
    await expect(page.getByText(/999/)).toHaveCount(0)

    const positions = await cards.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect()
        return { x: box.x, y: box.y, right: box.right }
      }),
    )
    expect(positions.filter((position) => position.y === positions[0].y)).toHaveLength(columns)
    expect(positions.every((position) => position.x >= 0 && position.right <= width)).toBe(true)
    expect(
      await page
        .locator('main')
        .last()
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true)
    expect(errors).toEqual([])
    if (width < 768) {
      await page.getByText('Menu', { exact: true }).click()
      const navigation = page.getByRole('navigation', { name: 'Điều hướng hội viên' })
      await expect(navigation.getByRole('link', { name: 'Gói của tôi' })).toBeVisible()
      await navigation.getByRole('link', { name: 'Gói của tôi' }).click()
      await expect(navigation).not.toBeVisible()
    }
    await page
      .locator('main')
      .last()
      .evaluate((element) => {
        element.scrollTop = 0
      })
    await page.screenshot({ path: testInfo.outputPath(`${label}.png`), fullPage: true })
  })
}

test('empty subscriptions use the existing catalog link', async ({ page }) => {
  await page.route('**/api/v1/memberships/subscriptions', (route) =>
    route.fulfill({ json: { success: true, data: [] } }),
  )
  await page.goto('/portal/member/subscriptions')
  await expect(page.getByRole('heading', { name: 'Bạn chưa có gói tập' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Khám phá gói tập' })).toHaveAttribute(
    'href',
    '/portal/member/plans',
  )
})
