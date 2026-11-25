import { expect, test } from '@playwright/test'

const email = process.env.E2E_MEMBER_EMAIL
const password = process.env.E2E_MEMBER_PASSWORD
test('member can log in, inspect catalog, VIP quote, subscriptions and weekly calendar', async ({
  page,
}) => {
  test.skip(!email || !password, 'Set E2E_MEMBER_EMAIL and E2E_MEMBER_PASSWORD')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/portal/member/bookings?week=2026-09-28')
  await expect(page).toHaveURL(/\/auth\/login/)
  await page.getByLabel('Email').fill(email!)
  await page.getByLabel('Mật khẩu').fill(password!)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/portal\/member\/bookings\?week=2026-09-28/)
  await expect(page.getByRole('heading', { name: 'Lịch tập của tôi' })).toBeVisible()
  await expect(page.locator('.day-column')).toHaveCount(7)
  await expect(page.locator('.subscription-chip').first()).toBeVisible()
  await expect(page.locator('.session-card').first()).toBeVisible()
  await page.getByRole('button', { name: 'Tuần sau' }).click()
  await expect(page).toHaveURL(/week=2026-10-05/)
  await page.getByRole('button', { name: 'Tuần trước' }).click()
  await expect(page).toHaveURL(/week=2026-09-28/)

  await page.getByRole('link', { name: 'Gói tập', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Chọn gói tập phù hợp' })).toBeVisible()
  await expect(page.locator('.plan-card').first()).toBeVisible()
  await page.getByLabel('Môn tập').selectOption({ label: 'Yoga & Meditation' })
  await page.getByLabel('Loại gói').selectOption('VIP')
  await expect(page.locator('.plan-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Chọn HLV & báo giá' }).click()
  await expect(
    page.getByRole('heading', { name: 'Báo giá VIP theo huấn luyện viên' }),
  ).toBeVisible()
  await page.getByLabel('Chọn HLV').selectOption({ index: 1 })
  await expect(page.getByText('Giá chỉ để tham khảo')).toBeVisible()

  await page.getByRole('link', { name: 'Gói của tôi' }).click()
  await expect(page.getByRole('heading', { name: 'Gói tập của tôi' })).toBeVisible()
  await expect(page.getByRole('article').first()).toBeVisible()
  await page.getByRole('link', { name: 'Hóa đơn' }).click()
  await expect(page.getByRole('heading', { name: 'Hóa đơn của tôi' })).toBeVisible()
  for (const [link, heading] of [
    ['Giao dịch', 'Lịch sử checkout'],
    ['Lịch sử', 'Hoạt động tập luyện'],
    ['Hồ sơ', 'Thông tin cá nhân'],
    ['InBody', 'Chỉ số cơ thể'],
    ['Giáo án', 'Bài tập của tôi'],
    ['Điểm danh', 'Lịch sử điểm danh'],
    ['Tủ đồ', 'Tủ đang sử dụng'],
  ]) {
    await page.getByRole('link', { name: link, exact: true }).click()
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    await expect(page.getByText('Đang tải dữ liệu…')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
  }
  await page.getByRole('button', { name: 'Đăng xuất' }).click()
  await expect(page).toHaveURL(/\/plans$/)
  await page.goto('/portal/member/subscriptions')
  await expect(page).toHaveURL(/\/auth\/login/)
  expect(errors).toEqual([])
})

test('console zone is identified as backlog', async ({ page }) => {
  await page.goto('/console')
  await expect(page.getByText('Console thuộc backlog triển khai.')).toBeVisible()
})
