import { AsyncLocalStorage } from 'node:async_hooks'

export interface RequestContext {
  accessToken: string
  requestId: string
  selectUser?: string
  selectAdmin?: string
}

const requestContextStore = new AsyncLocalStorage<RequestContext>()

export function runWithRequestContext<T>(context: RequestContext, callback: () => Promise<T>): Promise<T> {
  return requestContextStore.run(context, callback)
}

export function getRequestContext(): RequestContext {
  const context = requestContextStore.getStore()

  if (!context) {
    throw new Error('Request context is unavailable')
  }

  return context
}
