import { jest } from '@jest/globals'
import { DropboxResponseError } from 'dropbox'

export function buildDropboxResponse<T>(result: T) {
  return {
    status: 200,
    headers: new Headers(),
    result
  }
}

export function buildDropboxError(status: number, summary: string, error: unknown) {
  return new DropboxResponseError(status, new Headers(), {
    error_summary: summary,
    error
  })
}

export function createMockDropboxClient() {
  const createAsyncMock = () => jest.fn<(...args: any[]) => Promise<any>>()

  return {
    filesListFolder: createAsyncMock(),
    filesListFolderContinue: createAsyncMock(),
    filesGetMetadata: createAsyncMock(),
    filesCreateFolderV2: createAsyncMock(),
    filesDeleteV2: createAsyncMock(),
    filesDeleteBatch: createAsyncMock(),
    filesDeleteBatchCheck: createAsyncMock(),
    filesMoveV2: createAsyncMock(),
    filesMoveBatchV2: createAsyncMock(),
    filesMoveBatchCheckV2: createAsyncMock(),
    filesCopyV2: createAsyncMock(),
    filesCopyBatchV2: createAsyncMock(),
    filesCopyBatchCheckV2: createAsyncMock(),
    filesUpload: createAsyncMock(),
    filesUploadSessionStart: createAsyncMock(),
    filesUploadSessionAppendV2: createAsyncMock(),
    filesUploadSessionFinish: createAsyncMock(),
    filesDownload: createAsyncMock(),
    filesSearchV2: createAsyncMock(),
    filesSearchContinueV2: createAsyncMock(),
    filesListRevisions: createAsyncMock(),
    filesRestore: createAsyncMock(),
    filesGetTemporaryLink: createAsyncMock(),
    sharingCreateSharedLinkWithSettings: createAsyncMock(),
    sharingListSharedLinks: createAsyncMock(),
    sharingRevokeSharedLink: createAsyncMock(),
    sharingModifySharedLinkSettings: createAsyncMock(),
    sharingGetSharedLinkMetadata: createAsyncMock(),
    usersGetCurrentAccount: createAsyncMock(),
    usersGetSpaceUsage: createAsyncMock()
  }
}
