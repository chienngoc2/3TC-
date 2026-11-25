import type { Tokens, User } from './types'
import { resolveBackendConfig } from './backend-config'
const key = 'sportscenter.member.tokens'
const SESSION_MARKER = 'sportscenter.active_tab_session'
const { apiBaseUrl, socketOrigin } = resolveBackendConfig(
  import.meta.env.VITE_API_BASE_URL,
  import.meta.env.DEV,
)
export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}
export function readTokens(): Tokens | null {
  try {
    const value = localStorage.getItem(key)
    if (value) {
      const parsed = JSON.parse(value) as Tokens
      if (parsed && parsed.accessToken) {
        if (!sessionStorage.getItem(SESSION_MARKER)) {
          sessionStorage.setItem(SESSION_MARKER, 'true')
        }
        return parsed
      }
    }
    const accessToken = localStorage.getItem('access_token')
    const refreshToken = localStorage.getItem('refresh_token')
    if (accessToken && refreshToken) {
      if (!sessionStorage.getItem(SESSION_MARKER)) {
        sessionStorage.setItem(SESSION_MARKER, 'true')
      }
      return { accessToken, refreshToken }
    }
    return null
  } catch {
    return null
  }
}
export function saveTokens(tokens: Tokens, user?: User | null) {
  try {
    localStorage.setItem(key, JSON.stringify(tokens))
    localStorage.setItem('access_token', tokens.accessToken)
    localStorage.setItem('refresh_token', tokens.refreshToken)
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user))
    }
    sessionStorage.setItem(SESSION_MARKER, 'true')
  } catch {}
  window.dispatchEvent(new Event('session-changed'))
}
export function clearTokens() {
  try {
    localStorage.removeItem(key)
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_user')
    sessionStorage.removeItem(SESSION_MARKER)
  } catch {}
  window.dispatchEvent(new Event('session-changed'))
}
export function apiOrigin() {
  return socketOrigin || window.location.origin
}
let refreshFlight: Promise<Tokens> | null = null
async function refreshTokens(): Promise<Tokens> {
  if (!refreshFlight)
    refreshFlight = (async () => {
      const current = readTokens()
      if (!current?.refreshToken)
        throw new ApiError(401, 'SESSION_MISSING', 'Phiên đăng nhập đã hết hạn')
      let response: Response
      try {
        response = await fetch(`${apiBaseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        })
      } catch {
        throw new ApiError(0, 'NETWORK_UNAVAILABLE', 'Không thể kết nối để làm mới phiên')
      }
      const payload = (await response.json().catch(() => null)) as {
        data?: Tokens
        errorCode?: string
        message?: string
      } | null
      if (!response.ok || !payload?.data?.accessToken) {
        if (response.status === 401 || response.status === 403) clearTokens()
        throw new ApiError(
          response.status,
          payload?.errorCode ?? 'REFRESH_FAILED',
          String(payload?.message ?? 'Không thể làm mới phiên'),
        )
      }
      saveTokens(payload.data)
      return payload.data
    })().finally(() => {
      refreshFlight = null
    })
  return refreshFlight
}
export async function request<T>(
  path: string,
  init: RequestInit = {},
  isPublic = false,
): Promise<T> {
  const call = async (token?: string) => {
    let response: Response
    try {
      response = await fetch(`${apiBaseUrl}${path}`, {
        ...init,
        headers: {
          // FormData sets its own multipart boundary.
          ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      })
    } catch {
      throw new ApiError(0, 'NETWORK_UNAVAILABLE', 'Không thể kết nối máy chủ')
    }
    return response
  }
  let response = await call(isPublic ? undefined : readTokens()?.accessToken)
  if (response.status === 401 && !isPublic && readTokens()?.refreshToken) {
    const renewed = await refreshTokens()
    response = await call(renewed.accessToken)
  }
  const body = (await response.json().catch(() => null)) as {
    success?: boolean
    data?: T
    errorCode?: string
    message?: string | string[]
  } | null
  if (!response.ok || !body?.success) {
    if (response.status === 401 && !isPublic) clearTokens()
    throw new ApiError(
      response.status,
      body?.errorCode ?? 'REQUEST_FAILED',
      Array.isArray(body?.message)
        ? body.message.join(', ')
        : String(body?.message ?? `HTTP ${response.status}`),
    )
  }
  return body.data as T
}
export const get = <T>(path: string, isPublic = false) => request<T>(path, {}, isPublic)
export const post = <T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
  isPublic = false,
) => request<T>(path, { method: 'POST', body: JSON.stringify(body), headers }, isPublic)
export const put = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
export const money = (value: string | number | null | undefined) =>
  `${new Intl.NumberFormat('vi-VN').format(Number(value ?? 0))} ₫`
export const query = (params: Record<string, string | number | undefined | null>) => {
  const result = new URLSearchParams()
  for (const [name, value] of Object.entries(params))
    if (value !== undefined && value !== null && value !== '') result.set(name, String(value))
  return result.toString() ? `?${result}` : ''
}
const ERROR_TRANSLATIONS: Record<string, string> = {
  INVALID_PT_SUBSCRIPTION: 'Gói tập hiện tại không hỗ trợ hoặc chưa chỉ định Huấn luyện viên kèm riêng 1:1.',
  SUBSCRIPTION_NOT_FOUND: 'Không tìm thấy thông tin gói tập tương ứng.',
  FORBIDDEN_RESOURCE: 'Bạn không có quyền thực hiện thao tác này.',
  SESSION_MISSING: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
  NETWORK_UNAVAILABLE: 'Không thể kết nối máy chủ, vui lòng thử lại sau.',
  REQUEST_FAILED: 'Yêu cầu xử lý không thành công.',
  SUBSCRIPTION_EXPIRED: 'Gói tập của bạn đã hết hạn sử dụng.',
  COACH_NOT_AVAILABLE: 'Huấn luyện viên hiện không có lịch trống vào khung giờ này.',
  COACH_DISCIPLINE_MISMATCH: 'Huấn luyện viên không phụ trách bộ môn này. Vui lòng chọn HLV chuyên môn phù hợp.',
  BOOKING_CONFLICT: 'Khung giờ này đã bị trùng với một lịch hẹn khác của bạn.',
  CHECKOUT_NOT_FOUND: 'Không tìm thấy thông tin thanh toán.',
}

export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (ERROR_TRANSLATIONS[error.code]) return ERROR_TRANSLATIONS[error.code]
    if (ERROR_TRANSLATIONS[error.message]) return ERROR_TRANSLATIONS[error.message]
    return error.message && error.message !== error.code ? error.message : `Lỗi hệ thống (${error.code})`
  }
  if (error instanceof Error) {
    for (const [code, trans] of Object.entries(ERROR_TRANSLATIONS)) {
      if (error.message.includes(code)) return trans
    }
    return error.message
  }
  return 'Đã có lỗi xảy ra, vui lòng thử lại sau.'
}
export function internalReturnTo(value: unknown): string {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\')
    ? value
    : '/portal/member'
}
