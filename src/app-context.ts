import type { AppDatabase } from './persistence/database.js'
import type { DropboxAccountService } from './dropbox/account-service.js'
import type { DropboxMcpOAuthProvider } from './oauth/provider.js'

export interface AppContext {
  database: AppDatabase
  dropboxAccountService: DropboxAccountService
  oauthProvider: DropboxMcpOAuthProvider
}

let appContext: AppContext | undefined

export function setAppContext(context: AppContext): void {
  appContext = context
}

export function getAppContext(): AppContext {
  if (!appContext) {
    throw new Error('Application context has not been initialized.')
  }

  return appContext
}

