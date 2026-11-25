/** Shared by Vite, HTTP clients and Server-Sent Events (SSE). The env value is a backend origin. */
export function resolveBackendConfig(value = '', useProxy = false) {
  const input = value.trim()
  let origin = ''

  if (input) {
    const url = new URL(input)
    const path = url.pathname.replace(/\/+$/, '')
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (path !== '' && path !== '/api/v1' && path !== '/v1')
    ) {
      throw new Error(
        'VITE_API_BASE_URL must be an HTTP(S) backend origin, without /docs or other paths',
      )
    }
    // Accept the old README's /api/v1 suffix without duplicating the API prefix.
    origin = url.origin
  }

  return {
    proxyTarget: origin,
    apiBaseUrl: `${useProxy ? '' : origin}/api/v1`,
    socketOrigin: useProxy ? '' : origin,
  }
}
