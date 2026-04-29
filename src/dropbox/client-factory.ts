import { Dropbox } from 'dropbox'

import type { PathRoot } from './path-root.js'
import { serializePathRoot } from './path-root.js'

export interface DropboxClientOptions {
  pathRoot?: PathRoot
  selectUser?: string
  selectAdmin?: string
}

export function createDropboxClient(accessToken: string, options: DropboxClientOptions = {}): Dropbox {
  return new Dropbox({
    accessToken,
    pathRoot: serializePathRoot(options.pathRoot),
    selectUser: options.selectUser,
    selectAdmin: options.selectAdmin
  })
}
