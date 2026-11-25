import apiClient from '@/services/api-client'
import type {
  CalendarResponseData,
  CalendarViewMode,
  Discipline,
  GroupBookingPayload,
  PtBookingPayload,
  CancelBookingPayload,
  CancelBookingResponse,
} from '../types/calendar.types'

export interface GetCalendarParams {
  week: string // YYYY-MM-DD (Monday)
  disciplineId?: string
  view?: CalendarViewMode
}

export const getCalendarApi = async (params: GetCalendarParams): Promise<CalendarResponseData> => {
  const query = new URLSearchParams()
  query.append('week', params.week)

  if (params.disciplineId && params.disciplineId !== 'all') {
    query.append('disciplineId', params.disciplineId)
  }

  if (params.view && params.view !== 'all') {
    query.append('view', params.view)
  }

  const response = await apiClient.get<CalendarResponseData>(
    `/members/me/calendar?${query.toString()}`,
  )
  return response.data as unknown as CalendarResponseData
}

export const bookGroupClassApi = async (payload: GroupBookingPayload): Promise<unknown> => {
  const response = await apiClient.post('/bookings/group-class', payload)
  return response.data
}

export const bookPtSessionApi = async (payload: PtBookingPayload): Promise<unknown> => {
  const response = await apiClient.post('/bookings/pt', payload)
  return response.data
}

export const cancelBookingApi = async (
  bookingId: string,
  payload?: CancelBookingPayload,
): Promise<CancelBookingResponse> => {
  const response = await apiClient.put<CancelBookingResponse>(
    `/bookings/${bookingId}/cancel`,
    payload || {},
  )
  return response.data as unknown as CancelBookingResponse
}

export const getDisciplinesApi = async (): Promise<Discipline[]> => {
  const response = await apiClient.get<Discipline[]>('/disciplines')
  return response.data as unknown as Discipline[]
}

export const getWorkoutPlanByBookingApi = async (bookingId: string): Promise<unknown> => {
  try {
    const response = await apiClient.get(`/bookings/${bookingId}/workout-plan`)
    return response.data
  } catch {
    return null
  }
}
