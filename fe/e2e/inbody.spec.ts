import { expect, test, type Page } from '@playwright/test'
import type { InbodyLog } from '../src/lib/types'

test.use({ baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173' })

// Fixtures are confined to browser tests; the page continues to use its real API.
const logs: InbodyLog[] = [
  {
    id: 'latest',
    measuredAt: '2026-10-06T03:00:00Z',
    weightKg: '68.4',
    bodyFatPct: '18.2',
    muscleMassKg: '31.6',
    bmi: '22.3',
  },
  {
    id: 'first',
    measuredAt: '2026-08-06T03:00:00Z',
    weightKg: '72.5',
    bodyFatPct: '22.4',
    muscleMassKg: '30.1',
    bmi: '23.7',
  },
  {
    id: 'previous',
    measuredAt: '2026-09-06T03:00:00Z',
    weightKg: '70.2',
    bodyFatPct: '20.1',
    muscleMassKg: '30.8',
    bmi: '22.9',
  },
]

async function serveProgress(page: Page, measurements = logs) {
  await page.route('**/api/v1/inbody/my-progress', (route) =>
    route.fulfill({ json: { success: true, data: { logs: measurements } } }),
  )
}

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }),
  )
  await page.addInitScript(() => {
    // The app signs out when this per-tab marker is missing (closed tab).
    sessionStorage.setItem('sportscenter.active_tab_session', 'true')
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
  await serveProgress(page)
})

for (const [label, width] of [
  ['desktop', 1440],
  ['tablet', 1024],
  ['small-tablet', 768],
  ['mobile', 390],
  ['small-mobile', 320],
] as const) {
  test(`InBody hierarchy and controls on ${label}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.goto('/portal/member/progress')
    const viewer = page.getByRole('region', { name: 'Bản đồ cơ thể', exact: true })
    await expect(viewer.getByRole('heading', { name: 'Bản đồ cơ thể' })).toBeInViewport()
    const chart = page.getByRole('region', { name: 'Sơ đồ quá trình cải thiện', exact: true })
    const latest = page.getByRole('region', { name: 'Lần đo mới nhất', exact: true })
    const comparison = page.getByRole('region', { name: 'So sánh các lần đo', exact: true })
    const history = page.getByRole('region', { name: 'Lịch sử InBody', exact: true })
    await expect(viewer.getByRole('group', { name: 'Sơ đồ cơ nam, mặt trước' })).toBeVisible()
    await expect(viewer.getByRole('button', { name: 'Mặt trước' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // Weight, body fat, muscle and BMI side by side, each a smooth line.
    await expect(chart.locator('.recharts-area-curve')).toHaveCount(4)
    await expect(chart.getByRole('region', { name: 'Biểu đồ mỡ cơ thể' })).toContainText('18,2 %')
    const boxes = await Promise.all(
      [viewer, chart, latest, comparison, history].map((locator) => locator.boundingBox()),
    )
    const [viewerBox, chartBox, latestBox, comparisonBox, historyBox] = boxes.map((box) => box!)
    if (width >= 1280) {
      expect(Math.abs(viewerBox.y - chartBox.y)).toBeLessThan(2)
      expect(chartBox.x).toBeGreaterThan(viewerBox.x + viewerBox.width)
      // Charts and the shape card share the column beside the body map, ending level with it.
      const side = (await page.locator('.inbody-overview-side').boundingBox())!
      expect(Math.abs(viewerBox.height - side.height)).toBeLessThan(2)
    } else {
      expect(chartBox.y).toBeGreaterThan(viewerBox.y + viewerBox.height)
    }
    expect(latestBox.y).toBeGreaterThan(
      Math.max(viewerBox.y + viewerBox.height, chartBox.y + chartBox.height),
    )
    expect(comparisonBox.y).toBeGreaterThan(latestBox.y + latestBox.height)
    expect(historyBox.y).toBeGreaterThan(comparisonBox.y + comparisonBox.height)
    expect(boxes.every((box) => box && box.x >= 0 && box.x + box.width <= width)).toBe(true)
    expect(
      await page
        .locator('main')
        .last()
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true)
    expect(
      await chart
        .locator('.inbody-chart-plot')
        .first()
        .evaluate((element) => element.clientHeight),
    ).toBeGreaterThanOrEqual(100)
    await expect(latest.getByText('68,4')).toBeVisible()
    await expect(latest.getByText('−1,8 kg')).toBeVisible()
    await expect(history.getByText('3 lần đo')).toBeVisible()
    const historyRows = history.locator('tbody tr')
    await expect(historyRows).toHaveCount(3)
    await expect(historyRows.first()).toContainText('06/10/2026')
    await expect(historyRows.first()).toContainText('68,4 kg')
    expect(await history.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    )

    await viewer.getByRole('button', { name: 'Mặt sau' }).click()
    await expect(viewer.getByRole('group', { name: 'Sơ đồ cơ nam, mặt sau' })).toBeVisible()
    await viewer.getByRole('button', { name: 'Nữ' }).click()
    await expect(viewer.getByRole('group', { name: 'Sơ đồ cơ nữ, mặt sau' })).toBeVisible()
    await viewer.getByRole('button', { name: 'Mặt trước' }).click()
    await viewer.locator('path[data-slug="chest"]').first().hover()
    await expect(viewer.getByRole('status')).toContainText('Cơ ngực')
    await expect(viewer.getByRole('status')).toContainText('31,6 kg')
    await page
      .locator('main')
      .last()
      .evaluate((element) => {
        element.scrollTop = 0
      })
    await page.screenshot({ path: testInfo.outputPath(`${label}.png`), fullPage: true })
    await latest.screenshot({ path: testInfo.outputPath(`${label}-latest.png`) })
    await chart.screenshot({ path: testInfo.outputPath(`${label}-chart.png`) })
    await comparison.screenshot({ path: testInfo.outputPath(`${label}-comparison.png`) })
    await history.screenshot({ path: testInfo.outputPath(`${label}-history.png`) })
    expect(errors).toEqual([])
  })
}

test('empty progress keeps the body map and does not invent measurements', async ({ page }) => {
  await serveProgress(page, [])
  await page.goto('/portal/member/progress')
  await expect(
    page.getByText('Bạn chưa có lần đo InBody nào. Các chỉ số sẽ xuất hiện sau lần đo đầu tiên.'),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sơ đồ quá trình cải thiện' })).toBeVisible()
  await expect(page.locator('.inbody-chart-plot').first()).toHaveText(
    'Chưa có dữ liệu cân nặng để hiển thị biểu đồ.',
  )
  await expect(
    page.getByRole('region', { name: 'Lần đo mới nhất', exact: true }).getByText('—'),
  ).toHaveCount(4)
  await expect(page.getByRole('region', { name: 'So sánh các lần đo' })).toHaveCount(0)
  await expect(page.getByText('0 lần đo')).toBeVisible()
})

test('single, missing and undated measurements keep existing data semantics', async ({ page }) => {
  await serveProgress(page, [
    { ...logs[0], bodyFatPct: null },
    { ...logs[1], id: 'undated', measuredAt: 'invalid-date' },
  ])
  await page.goto('/portal/member/progress')
  await expect(page.getByText('Cần thêm lần đo để xem xu hướng.')).toBeVisible()
  await expect(page.getByText(/1 bản ghi chưa có ngày đo hợp lệ/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'So sánh các lần đo' })).toHaveCount(0)
  await expect(
    page.getByRole('region', { name: 'Lịch sử InBody', exact: true }).locator('tbody tr'),
  ).toHaveCount(2)
  await expect(
    page.getByRole('region', { name: 'Biểu đồ mỡ cơ thể' }).locator('.inbody-chart-plot'),
  ).toHaveText('Chưa có dữ liệu mỡ cơ thể để hiển thị biểu đồ.')
})

test('body map reshapes per measurement, remembers gender and shows segment data', async ({
  page,
}) => {
  await serveProgress(page, [
    { ...logs[1], weightKg: '95', bodyFatPct: '31', bmi: '31' },
    {
      ...logs[0],
      heightCm: '175',
      segmentalLean: { rightArm: '3.4', leftArm: '3.0', trunk: '26.1', rightLeg: null },
      analysis: { bodyShape: 'TYPE_D' },
    },
  ])
  await page.goto('/portal/member/progress')
  const viewer = page.getByRole('region', { name: 'Bản đồ cơ thể', exact: true })
  const waist = () =>
    viewer
      .locator('[data-shape="core"]')
      .evaluate((element) =>
        Number(/scaleX\(([\d.]+)\)/.exec((element as SVGGElement).style.transform)?.[1]),
      )
  const leanWaist = await waist()
  // Options are newest first; index 1 is the earlier, heavier measurement.
  await viewer.getByLabel('Lần đo').selectOption({ index: 1 })
  await expect.poll(waist).toBeGreaterThan(leanWaist)
  await viewer.getByLabel('Lần đo').selectOption({ index: 0 })
  // The asset's left path is the member's right arm when facing the viewer.
  await viewer.locator('path[data-slug="biceps"][data-side="left"]').first().hover()
  await expect(viewer.getByRole('status')).toContainText('Cơ tay trước phải')
  await expect(viewer.getByRole('status')).toContainText('3,4 kg')
  // The left arm is 12,5% weaker than the right: flagged in red and called out above the map.
  await expect(viewer.getByRole('note')).toContainText('Tay trái yếu hơn bên còn lại 12,5%')
  await page.mouse.move(0, 0)
  await expect(
    viewer.locator('path[data-slug="biceps"][data-side="right"]').first(),
  ).toHaveAttribute('fill', '#ef4444')
  const shape = page.getByRole('region', { name: 'Hình thái cơ thể' })
  await expect(shape).toContainText('Dáng chữ D')
  await expect(shape.getByRole('img', { name: /Cân nặng \d+% so với chuẩn/ })).toBeVisible()
  await viewer.getByRole('button', { name: 'Nữ' }).click()
  await page.reload()
  await expect(
    page
      .getByRole('region', { name: 'Bản đồ cơ thể', exact: true })
      .getByRole('button', { name: 'Nữ' }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('body map follows the gender in the member profile', async ({ page }) => {
  await page.addInitScript(() => {
    const user = JSON.parse(localStorage.getItem('auth_user') ?? '{}')
    localStorage.setItem('auth_user', JSON.stringify({ ...user, gender: 'FEMALE' }))
  })
  await page.goto('/portal/member/progress')
  const viewer = page.getByRole('region', { name: 'Bản đồ cơ thể', exact: true })
  await expect(viewer.getByRole('group', { name: 'Sơ đồ cơ nữ, mặt trước' })).toBeVisible()
  await expect(viewer.getByText('Dáng người theo giới tính trong hồ sơ của bạn.')).toBeVisible()
  // Viewing the other figure is allowed but never overrides the profile.
  await viewer.getByRole('button', { name: 'Nam' }).click()
  await expect(viewer.getByRole('group', { name: 'Sơ đồ cơ nam, mặt trước' })).toBeVisible()
  await page.reload()
  await expect(
    page
      .getByRole('region', { name: 'Bản đồ cơ thể', exact: true })
      .getByRole('group', { name: 'Sơ đồ cơ nữ, mặt trước' }),
  ).toBeVisible()
})
