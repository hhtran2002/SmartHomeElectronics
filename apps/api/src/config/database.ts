import sql from 'mssql/msnodesqlv8.js'

const config: sql.config = {
  server: process.env.DB_SERVER ?? 'localhost\\SQLEXPRESS',
  database: process.env.DB_NAME ?? 'SmartHomeElectronicsDB',
  driver: 'msnodesqlv8',
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
