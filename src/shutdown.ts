import type { Server as HttpServer } from 'node:http'

export interface GracefulShutdownOptions {
  closeSessions: () => Promise<void>
  server: HttpServer
  timeoutMs: number
}

export async function gracefulShutdown(options: GracefulShutdownOptions): Promise<void> {
  const closeServerPromise = new Promise<void>((resolve, reject) => {
    options.server.close(error => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('HTTP server shutdown timed out'))
    }, options.timeoutMs)
  })

  await options.closeSessions()
  await Promise.race([closeServerPromise, timeoutPromise])
}
