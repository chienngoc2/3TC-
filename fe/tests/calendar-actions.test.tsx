import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { SessionContext } from '../src/auth/session-context'
import { CalendarPage } from '../src/pages/CalendarPage'
import { addDays, mondayInVietnam, shiftWeek } from '../src/lib/date'
import type { CalendarData } from '../src/lib/types'

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), { status: 200 })

it('books group/PT with server-selected subscription and cancels an existing booking', async () => {
  const week = shiftWeek(mondayInVietnam(), 1)
  const day = addDays(week, 1)
  const startAt = `${day}T03:00:00.000Z`
  const data: CalendarData = {
    weekStart: week,
    weekEndExclusive: shiftWeek(week, 1),
    timezone: 'Asia/Ho_Chi_Minh',
    schedules: [
      {
        id: 'class-1',
        disciplineId: 'yoga',
        startAt,
        endAt: `${day}T04:00:00.000Z`,
        capacity: 10,
        currentEnrolled: 2,
        status: 'OPEN',
        class: { name: 'Hatha Yoga' },
        coach: { id: 'coach-1', fullName: 'Coach A' },
        room: { name: 'Studio' },
      },
    ],
    ptSlots: [
      {
        id: 'slot-1',
        coachId: 'coach-1',
        coach: { id: 'coach-1', fullName: 'Coach A' },
        startAt: `${day}T05:00:00.000Z`,
        endAt: `${day}T06:00:00.000Z`,
        eligibleDisciplines: ['yoga'],
      },
    ],
    bookings: [
      {
        id: 'booking-1',
        subscriptionId: 'active-yoga',
        disciplineId: 'yoga',
        bookingType: 'PERSONAL_TRAINING',
        status: 'CONFIRMED',
        startAt: `${day}T07:00:00.000Z`,
        bookedAt: `${day}T00:00:00.000Z`,
      },
    ],
    subscriptions: [
      {
        id: 'active-yoga',
        disciplineId: 'yoga',
        planName: 'Yoga VIP',
        assignedCoach: null,
        startDate: week,
        endDate: shiftWeek(week, 2),
        status: 'ACTIVE',
        remainingGroupSessions: 5,
        remainingPtSessions: 3,
      },
    ],
    days: Array.from({ length: 7 }, (_, index) => ({
      date: addDays(week, index),
      eligibility: [
        {
          subscriptionId: 'active-yoga',
          disciplineId: 'yoga',
          group: { allowed: true, reason: null },
          pt: { allowed: true, reason: null },
        },
      ],
    })),
  }
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.includes('/disciplines'))
      return Promise.resolve(envelope([{ id: 'yoga', name: 'Yoga & Meditation', code: 'YOGA' }]))
    if (url.includes('/members/me/calendar')) return Promise.resolve(envelope(data))
    if (url.endsWith('/bookings/group-class') || url.endsWith('/bookings/pt'))
      return Promise.resolve(envelope({ subscriptionId: 'active-yoga' }))
    if (url.endsWith('/bookings/booking-1/cancel') && init?.method === 'PUT')
      return Promise.resolve(envelope({ status: 'CANCELLED' }))
    return Promise.resolve(envelope([]))
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
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
        <MemoryRouter initialEntries={[`/portal/member/bookings?week=${week}`]}>
          <CalendarPage week={week} />
        </MemoryRouter>
      </SessionContext.Provider>
    </QueryClientProvider>,
  )
  await screen.findByText('Hatha Yoga')
  fireEvent.click(screen.getByRole('button', { name: 'Đặt lớp' }))
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          url.endsWith('/bookings/group-class') &&
          init?.method === 'POST' &&
          JSON.parse(init.body as string).scheduleId === 'class-1',
      ),
    ).toBe(true),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Đặt PT' }))
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          url.endsWith('/bookings/pt') &&
          init?.method === 'POST' &&
          JSON.parse(init.body as string).coachAvailabilityId === 'slot-1' &&
          JSON.parse(init.body as string).disciplineId === 'yoga',
      ),
    ).toBe(true),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Hủy lịch' }))
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => url.endsWith('/bookings/booking-1/cancel') && init?.method === 'PUT',
      ),
    ).toBe(true),
  )
  expect(
    fetchMock.mock.calls.filter(([url]) => url.includes('/members/me/calendar')).length,
  ).toBeGreaterThan(1)
  vi.restoreAllMocks()
})
