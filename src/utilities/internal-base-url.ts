import { getServerSideURL } from './getURL'

type HeaderGetter = { get?: (name: string) => string | null } | null | undefined

type RequestLike = { headers?: HeaderGetter } | null | undefined

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function parseHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function getInternalBaseUrl(request?: RequestLike): string {
  const fallback = getServerSideURL()
  const fallbackHost = parseHost(fallback)
  const allowedHosts = new Set(LOCALHOST_HOSTS)
  if (fallbackHost) {
    allowedHosts.add(fallbackHost)
  }

  const origin = request?.headers?.get?.('origin')
  if (origin) {
    const originHost = parseHost(origin)
    if (originHost && allowedHosts.has(originHost)) {
      return origin
    }
  }

  return fallback
}
