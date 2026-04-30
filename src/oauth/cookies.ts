import type { Response, Request } from 'express'

import { appConfig } from '../config.js'

function parseCookieHeader(headerValue: string | undefined): Record<string, string> {
  if (!headerValue) {
    return {}
  }

  const cookies: Record<string, string> = {}

  for (const part of headerValue.split(';')) {
    const [rawName, ...rawValueParts] = part.trim().split('=')
    if (!rawName) {
      continue
    }

    cookies[rawName] = decodeURIComponent(rawValueParts.join('='))
  }

  return cookies
}

export function getBrowserSessionId(req: Request): string | undefined {
  const cookies = parseCookieHeader(req.headers.cookie)
  return cookies[appConfig.sessionCookieName]
}

export function setBrowserSessionCookie(res: Response, sessionId: string): void {
  res.cookie(appConfig.sessionCookieName, sessionId, {
    httpOnly: true,
    secure: appConfig.publicBaseUrl.startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    maxAge: appConfig.sessionTtlHours * 60 * 60 * 1000
  })
}

export function clearBrowserSessionCookie(res: Response): void {
  res.clearCookie(appConfig.sessionCookieName, {
    httpOnly: true,
    secure: appConfig.publicBaseUrl.startsWith('https://'),
    sameSite: 'lax',
    path: '/'
  })
}

