import { z } from 'zod'
import type { common } from 'dropbox'

const pathRootHomeSchema = z.object({
  '.tag': z.literal('home')
})

const pathRootRootSchema = z.object({
  '.tag': z.literal('root'),
  root: z.string().min(1)
})

const pathRootNamespaceSchema = z.object({
  '.tag': z.literal('namespace_id'),
  namespace_id: z.string().min(1)
})

export const pathRootSchema = z.union([
  pathRootHomeSchema,
  pathRootRootSchema,
  pathRootNamespaceSchema
])

export type PathRoot = common.PathRoot

export function serializePathRoot(pathRoot: PathRoot | undefined): string | undefined {
  if (!pathRoot) {
    return undefined
  }

  return JSON.stringify(pathRoot)
}
