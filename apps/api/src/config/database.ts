import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import sql from 'mssql/msnodesqlv8.js'

loadEnv({
  path: resolve(__dirname, '../../../../.env'),
  quiet: true,
})

const config: sql.config = {
  server: process.env.DB_SERVER ?? 'localhost\\SQLEXPRESS',
  database: process.env.DB_NAME ?? 'SmartHomeElectronicsDB',
  driver: 'msnodesqlv8',
  connectionTimeout: 10_000,
  options: {
    trustedConnection: process.env.DB_TRUSTED_CONNECTION !== 'false',
    trustServerCertificate: true,
  },
  pool: {
    min: 0,
    max: 10,
    idleTimeoutMillis: 30_000,
  },
}

let poolPromise: Promise<sql.ConnectionPool> | undefined

export function getPool() {
  poolPromise ??= sql.connect(config)
  return poolPromise
}

export { sql }
