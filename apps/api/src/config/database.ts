import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import sql from 'mssql/msnodesqlv8.js'

loadEnv({
  path: resolve(__dirname, '../../../../.env'),
  quiet: true,
})

function requireEnv(name: 'DB_SERVER' | 'DB_NAME' | 'DB_TRUSTED_CONNECTION') {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const trustedConnection = requireEnv('DB_TRUSTED_CONNECTION')
if (trustedConnection !== 'true' && trustedConnection !== 'false') {
  throw new Error('DB_TRUSTED_CONNECTION must be either "true" or "false".')
}

const config: sql.config = {
  server: requireEnv('DB_SERVER'),
  database: requireEnv('DB_NAME'),
  driver: process.env.DB_DRIVER?.trim() || 'msnodesqlv8',
  connectionTimeout: 10_000,
  options: {
    trustedConnection: trustedConnection === 'true',
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
