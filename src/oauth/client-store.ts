import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'

import { appConfig } from '../config.js'

export class StaticOauthClientsStore implements OAuthRegisteredClientsStore {
  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    if (clientId !== appConfig.oauthClientId) {
      return undefined
    }

    return {
      client_id: appConfig.oauthClientId,
      client_secret: appConfig.oauthClientSecret,
      redirect_uris: appConfig.oauthRedirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: 'mcp:tools'
    }
  }
}

