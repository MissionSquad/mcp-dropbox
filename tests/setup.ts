import { beforeAll } from '@jest/globals'

beforeAll(() => {
  process.env.NODE_ENV = 'test'
})
