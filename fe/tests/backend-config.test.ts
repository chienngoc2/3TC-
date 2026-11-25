import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveBackendConfig } from '../src/lib/backend-config'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('backend deployment configuration', () => {
  it.each([
    { dev: true, value: 'https://backend.example', origin: 'https://backend.example' },
    { dev: false, value: 'https://backend.example/', origin: 'https://backend.example' },
    { dev: false, value: ' https://backend.example/api/v1/ ', origin: 'https://backend.example' },
    { dev: false, value: 'http://localhost:3000', origin: 'http://localhost:3000' },
  ])(
    'keeps HTTP, refresh and Socket URLs consistent for $value (dev=$dev)',
    async ({ dev, value, origin }) => {
      vi.stubEnv('VITE_API_BASE_URL', value)
      vi.stubEnv('DEV', dev)
      vi.resetModules()
      const { get, saveTokens, apiOrigin } = await import('../src/lib/api')
      const { apiClient } = await import('../src/services/api-client')
      const base = `${dev ? '' : origin}/api/v1`
      expect(apiClient.getUri({ url: '/auth/login' })).toBe(`${base}/auth/login`)
      expect(apiOrigin()).toBe(dev ? window.location.origin : origin)

      saveTokens({ accessToken: 'expired', refreshToken: 'refresh-old' })
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response('{}', { status: 401 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: true,
              data: { accessToken: 'renewed', refreshToken: 'refresh-new' },
            }),
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ success: true, data: { id: 'member-1' } })),
        )
      vi.stubGlobal('fetch', fetchMock)
      await expect(get('/users/profile/me')).resolves.toEqual({ id: 'member-1' })
      expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
        `${base}/users/profile/me`,
        `${base}/auth/refresh`,
        `${base}/users/profile/me`,
      ])
      expect(resolveBackendConfig(value, dev).proxyTarget).toBe(origin)
    },
  )

  it.each([
    'https://backend.example/docs',
    'https://backend.example/api/v2',
    'https://user:password@backend.example',
    'https://backend.example?token=secret',
    'https://backend.example#docs',
    'ftp://backend.example',
  ])('rejects an invalid backend origin: %s', (value) => {
    expect(() => resolveBackendConfig(value)).toThrow('VITE_API_BASE_URL')
  })
})
