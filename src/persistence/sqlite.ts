import fs from 'node:fs'
import path from 'node:path'
import sqlite3 from 'sqlite3'

sqlite3.verbose()

export class SQLiteDatabase {
  private db: sqlite3.Database | undefined

  constructor(private readonly filename: string) {}

  async open(): Promise<void> {
    const directory = path.dirname(this.filename)
    await fs.promises.mkdir(directory, { recursive: true })

    await new Promise<void>((resolve, reject) => {
      this.db = new sqlite3.Database(this.filename, error => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }

  async close(): Promise<void> {
    if (!this.db) {
      return
    }

    await new Promise<void>((resolve, reject) => {
      this.db!.close(error => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }

  async exec(sql: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.assertDb().exec(sql, error => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }

  async run(sql: string, params: unknown[] = []): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.assertDb().run(sql, params, error => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return new Promise<T | undefined>((resolve, reject) => {
      this.assertDb().get(sql, params, (error, row) => {
        if (error) {
          reject(error)
          return
        }

        resolve(row as T | undefined)
      })
    })
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      this.assertDb().all(sql, params, (error, rows) => {
        if (error) {
          reject(error)
          return
        }

        resolve(rows as T[])
      })
    })
  }

  private assertDb(): sqlite3.Database {
    if (!this.db) {
      throw new Error('SQLite database has not been opened.')
    }

    return this.db
  }
}

