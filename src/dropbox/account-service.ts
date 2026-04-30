import { Dropbox, DropboxAuth, DropboxResponseError } from 'dropbox'

import { appConfig } from '../config.js'
import type { PathRoot } from './path-root.js'
import { serializePathRoot } from './path-root.js'
import { resolveDelegationSelectors } from './team-member-resolver.js'
import { mapDropboxError, isSelectUserRequiredDropboxError } from '../errors/map-dropbox-error.js'
import { AppDatabase } from '../persistence/database.js'

export interface LinkedDropboxAccountContext {
  linkedAccountId: string
  email?: string
}

function createDropboxClient(
  auth: DropboxAuth,
  pathRoot: PathRoot | undefined,
  selectUser?: string
): Dropbox {
  return new Dropbox({
    auth,
    pathRoot: serializePathRoot(pathRoot),
    selectUser
  })
}

export class DropboxAccountService {
  constructor(private readonly database: AppDatabase) {}

  async executeForLinkedAccount<T>(
    linkedAccountId: string,
    pathRoot: PathRoot | undefined,
    endpoint: string,
    callback: (client: Dropbox) => Promise<T>
  ): Promise<{ result: T; email?: string; usedDelegatedUser: boolean }> {
    const persisted = await this.database.getPersistedDropboxAuth(linkedAccountId)

    if (!persisted) {
      throw new Error(`Linked Dropbox account ${linkedAccountId} not found`)
    }

    const auth = new DropboxAuth({
      accessToken: persisted.accessToken,
      accessTokenExpiresAt: persisted.accessTokenExpiresAt,
      refreshToken: persisted.refreshToken,
      clientId: appConfig.dropboxAppKey,
      clientSecret: appConfig.dropboxAppSecret
    })

    let usedDelegatedUser = false

    try {
      await auth.checkAndRefreshAccessToken()
      let result: T

      try {
        result = await callback(createDropboxClient(auth, pathRoot))
      } catch (error) {
        if (!persisted.email || !isSelectUserRequiredDropboxError(error)) {
          throw error
        }

        const delegation = await resolveDelegationSelectors(auth.getAccessToken(), persisted.email)
        usedDelegatedUser = Boolean(delegation.selectUser)
        result = await callback(createDropboxClient(auth, pathRoot, delegation.selectUser))
      }

      await this.database.updatePersistedDropboxAuth({
        linkedAccountId,
        dropboxAccountId: persisted.dropboxAccountId,
        email: persisted.email,
        refreshToken: auth.getRefreshToken(),
        accessToken: auth.getAccessToken(),
        accessTokenExpiresAt: auth.getAccessTokenExpiresAt()
      })

      return {
        result,
        email: persisted.email,
        usedDelegatedUser
      }
    } catch (error) {
      if (error instanceof DropboxResponseError) {
        throw mapDropboxError(error, endpoint)
      }

      throw error
    }
  }
}

