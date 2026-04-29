import { describe, expect, it } from '@jest/globals'
import { DropboxResponseError } from 'dropbox'
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js'

import { mapDropboxError } from '../../src/errors/map-dropbox-error.js'

describe('mapDropboxError', () => {
  it('maps nested Dropbox path errors to stable metadata', () => {
    const error = new DropboxResponseError(409, new Headers(), {
      error_summary: 'path/not_found/..',
      error: {
        '.tag': 'path',
        path: {
          '.tag': 'not_found'
        }
      }
    })

    const mapped = mapDropboxError(error, '/2/files/get_metadata')

    expect(mapped.code).toBe(ErrorCode.InvalidParams)
    expect(mapped.data).toEqual(expect.objectContaining({
      code: 'dropbox_path_error',
      tag_path: 'path/not_found'
    }))
  })
})
