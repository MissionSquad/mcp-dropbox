import { randomUUID } from 'node:crypto'
import type { Response } from 'express'
import { Dropbox, DropboxAuth } from 'dropbox'
import type { OAuthTokens, OAuthClientInformationFull, OAuthTokenRevocationRequest } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { AuthorizationParams, OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { InvalidGrantError, InvalidRequestError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js'

import { appConfig, getMcpEndpointUrl } from '../config.js'
import { AppDatabase } from '../persistence/database.js'
import { StaticOauthClientsStore } from './client-store.js'
import { clearBrowserSessionCookie, getBrowserSessionId, setBrowserSessionCookie } from './cookies.js'
import { logger } from '../logger.js'
import { resourceUrlFromServerUrl, checkResourceAllowed } from '@modelcontextprotocol/sdk/shared/auth-utils.js'

const dropboxTokenResponseSchema = {
  access_token: 'string',
  refresh_token: 'string'
} as const

function assertDropboxTokenResponse(value: unknown): asserts value is {
  access_token: string
  refresh_token: string
  expires_in?: number
} {
  const record = value as Record<string, unknown>

  if (typeof record.access_token !== 'string' || typeof record.refresh_token !== 'string') {
    throw new Error('Dropbox OAuth token response did not include access_token and refresh_token')
  }
}

function renderHtml(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family: sans-serif; max-width: 720px; margin: 40px auto; line-height: 1.5;">${body}</body></html>`
}

export class DropboxMcpOAuthProvider implements OAuthServerProvider {
  readonly clientsStore = new StaticOauthClientsStore()

  constructor(private readonly database: AppDatabase) {}

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const sessionId = getBrowserSessionId(res.req)

    if (!sessionId) {
      res.redirect(302, this.buildDropboxStartUrl(client, params).toString())
      return
    }

    const session = await this.database.getBrowserSession(sessionId)

    if (!session) {
      clearBrowserSessionCookie(res)
      res.redirect(302, this.buildDropboxStartUrl(client, params).toString())
      return
    }

    const code = randomUUID()

    await this.database.createAuthorizationCode({
      code,
      clientId: client.client_id,
      linkedAccountId: session.linkedAccountId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      scopesJson: JSON.stringify(params.scopes ?? ['mcp:tools']),
      resource: params.resource?.toString() ?? null,
      state: params.state ?? null,
      expiresAt: new Date(Date.now() + 10 * 60_000)
    })

    const targetUrl = new URL(params.redirectUri)
    targetUrl.searchParams.set('code', code)

    if (params.state) {
      targetUrl.searchParams.set('state', params.state)
    }

    res.redirect(302, targetUrl.toString())
  }

  async challengeForAuthorizationCode(_client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const record = await this.database.getAuthorizationCode(authorizationCode)

    if (!record) {
      throw new InvalidGrantError('Invalid authorization code')
    }

    return record.codeChallenge
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL
  ): Promise<OAuthTokens> {
    const record = await this.database.consumeAuthorizationCode(authorizationCode)

    if (!record) {
      throw new InvalidGrantError('Invalid authorization code')
    }

    if (record.clientId !== client.client_id) {
      throw new InvalidGrantError('Authorization code was not issued to this client')
    }

    if (redirectUri && record.redirectUri !== redirectUri) {
      throw new InvalidGrantError('Authorization code redirect URI mismatch')
    }

    if (resource && record.resource && !checkResourceAllowed({ requestedResource: resource, configuredResource: record.resource })) {
      throw new InvalidGrantError('Authorization code resource mismatch')
    }

    const issued = await this.database.issueMcpTokens({
      clientId: client.client_id,
      linkedAccountId: record.linkedAccountId,
      scopes: JSON.parse(record.scopesJson) as string[],
      resource: resource?.toString() ?? record.resource ?? undefined,
      accessTokenTtlSeconds: appConfig.oauthAccessTokenTtlSeconds
    })

    return {
      access_token: issued.accessToken,
      refresh_token: issued.refreshToken,
      token_type: 'bearer',
      expires_in: issued.expiresIn,
      scope: (JSON.parse(record.scopesJson) as string[]).join(' ')
    }
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL
  ): Promise<OAuthTokens> {
    const exchanged = await this.database.exchangeMcpRefreshToken({
      refreshToken,
      clientId: client.client_id,
      scopes,
      resource: resource?.toString(),
      accessTokenTtlSeconds: appConfig.oauthAccessTokenTtlSeconds
    })

    if (!exchanged) {
      throw new InvalidGrantError('Invalid refresh token')
    }

    return {
      access_token: exchanged.accessToken,
      refresh_token: exchanged.refreshToken,
      token_type: 'bearer',
      expires_in: exchanged.expiresIn,
      scope: exchanged.scopes.join(' ')
    }
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const record = await this.database.verifyMcpAccessToken(token)

    if (!record) {
      throw new InvalidTokenError('Invalid access token')
    }

    const mcpResource = resourceUrlFromServerUrl(getMcpEndpointUrl())

    if (record.resource && !checkResourceAllowed({ requestedResource: record.resource, configuredResource: mcpResource })) {
      throw new InvalidTokenError('Token was issued for a different resource')
    }

    return {
      token,
      clientId: record.clientId,
      scopes: record.scopes,
      expiresAt: record.expiresAtEpochSeconds,
      resource: record.resource ? new URL(record.resource) : undefined,
      extra: {
        linkedAccountId: record.linkedAccountId
      }
    }
  }

  async revokeToken(_client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    await this.database.revokeMcpToken(request.token)
  }

  async startDropboxAuthorization(nextUrl: string): Promise<URL> {
    const state = await this.database.createDropboxOauthState(nextUrl)
    const auth = new DropboxAuth({
      clientId: appConfig.dropboxAppKey,
      clientSecret: appConfig.dropboxAppSecret
    })
    const authUrl = await auth.getAuthenticationUrl(
      appConfig.dropboxRedirectUri,
      state,
      'code',
      'offline',
      appConfig.dropboxScopes
    )

    return new URL(String(authUrl))
  }

  async handleDropboxCallback(input: { code?: string; state?: string; error?: string; errorDescription?: string }, res: Response): Promise<void> {
    if (input.error) {
      res.status(400).send(
        renderHtml(
          'Dropbox Connect Failed',
          `<h1>Dropbox connection failed</h1><p>${input.errorDescription ?? input.error}</p>`
        )
      )
      return
    }

    if (!input.code || !input.state) {
      throw new InvalidRequestError('Dropbox callback requires code and state')
    }

    const stateRecord = await this.database.consumeDropboxOauthState(input.state)

    if (!stateRecord) {
      throw new InvalidRequestError('Dropbox OAuth state is invalid or expired')
    }

    const auth = new DropboxAuth({
      clientId: appConfig.dropboxAppKey,
      clientSecret: appConfig.dropboxAppSecret
    })

    const tokenResponse = await auth.getAccessTokenFromCode(appConfig.dropboxRedirectUri, input.code)
    assertDropboxTokenResponse(tokenResponse.result)

    const accountInfo = await this.fetchDropboxAccountInfo(
      tokenResponse.result.access_token,
      tokenResponse.result.refresh_token,
      tokenResponse.result.expires_in
    )

    const linkedAccount = await this.database.upsertLinkedDropboxAccount({
      dropboxAccountId: accountInfo.dropboxAccountId,
      email: accountInfo.email,
      refreshToken: tokenResponse.result.refresh_token,
      accessToken: tokenResponse.result.access_token,
      accessTokenExpiresAt:
        typeof tokenResponse.result.expires_in === 'number'
          ? new Date(Date.now() + tokenResponse.result.expires_in * 1000)
          : undefined
    })

    const sessionId = await this.database.createBrowserSession(linkedAccount.id, appConfig.sessionTtlHours)
    setBrowserSessionCookie(res, sessionId)

    res.redirect(302, stateRecord.nextUrl)
  }

  private buildDropboxStartUrl(client: OAuthClientInformationFull, params: AuthorizationParams): URL {
    const nextUrl = new URL('/authorize', appConfig.oauthIssuerUrl)
    nextUrl.searchParams.set('client_id', client.client_id)
    nextUrl.searchParams.set('redirect_uri', params.redirectUri)
    nextUrl.searchParams.set('response_type', 'code')
    nextUrl.searchParams.set('code_challenge', params.codeChallenge)
    nextUrl.searchParams.set('code_challenge_method', 'S256')

    if (params.state) {
      nextUrl.searchParams.set('state', params.state)
    }

    if (params.scopes && params.scopes.length > 0) {
      nextUrl.searchParams.set('scope', params.scopes.join(' '))
    }

    if (params.resource) {
      nextUrl.searchParams.set('resource', params.resource.toString())
    }

    const redirect = new URL('/oauth/dropbox/start', appConfig.oauthIssuerUrl)
    redirect.searchParams.set('next', nextUrl.toString())
    return redirect
  }

  private async fetchDropboxAccountInfo(
    accessToken: string,
    refreshToken: string,
    expiresIn?: number
  ): Promise<{ dropboxAccountId?: string; email?: string }> {
    const auth = new DropboxAuth({
      accessToken,
      accessTokenExpiresAt: typeof expiresIn === 'number' ? new Date(Date.now() + expiresIn * 1000) : undefined,
      refreshToken,
      clientId: appConfig.dropboxAppKey,
      clientSecret: appConfig.dropboxAppSecret
    })
    const client = new Dropbox({ auth })

    try {
      const response = await client.usersGetCurrentAccount()
      return {
        dropboxAccountId: response.result.account_id,
        email: response.result.email
      }
    } catch (error) {
      logger.warn({ err: error }, 'Unable to fetch Dropbox account email during callback; storing link without email')
      return {}
    }
  }
}
