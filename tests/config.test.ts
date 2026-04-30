import { describe, expect, it } from 'vitest'

import { resolveRequestConfig } from '../src/config.js'

describe('resolveRequestConfig', () => {
  it('prefers hidden extraArgs over environment-style defaults', () => {
    const result = resolveRequestConfig(
      {
        accessToken: 'hidden-token',
        email: 'hidden@example.com'
      },
      {
        defaultAccessToken: 'env-token',
        defaultEmail: 'env@example.com',
        logLevel: 'info',
        dropboxRetryMaxAttempts: 3,
        dropboxRetryBaseDelayMs: 250
      }
    )

    expect(result.accessToken).toBe('hidden-token')
    expect(result.email).toBe('hidden@example.com')
  })

  it('falls back to defaults when hidden values are absent', () => {
    const result = resolveRequestConfig(
      undefined,
      {
        defaultAccessToken: 'env-token',
        defaultEmail: 'env@example.com',
        logLevel: 'info',
        dropboxRetryMaxAttempts: 3,
        dropboxRetryBaseDelayMs: 250
      }
    )

    expect(result.accessToken).toBe('env-token')
    expect(result.email).toBe('env@example.com')
  })

  it('throws when no token is available', () => {
    expect(() =>
      resolveRequestConfig(undefined, {
        defaultAccessToken: undefined,
        defaultEmail: undefined,
        logLevel: 'info',
        dropboxRetryMaxAttempts: 3,
        dropboxRetryBaseDelayMs: 250
      })
    ).toThrow(/Dropbox access token is required/)
  })

  it('keeps selector values as raw strings before runtime delegation resolution', () => {
    const result = resolveRequestConfig(
      {
        accessToken: 'hidden-token',
        email: 'user@example.com'
      },
      {
        defaultAccessToken: undefined,
        defaultEmail: undefined,
        logLevel: 'info',
        dropboxRetryMaxAttempts: 3,
        dropboxRetryBaseDelayMs: 250
      }
    )

    expect(result.email).toBe('user@example.com')
  })
})
