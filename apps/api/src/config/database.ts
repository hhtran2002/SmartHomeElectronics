import 'dotenv/config'
import sql from 'mssql/msnodesqlv8.js'

const server = process.env.DB_SERVER ?? 'DESKTOP-A2DR18E\\SQLEXPRESS'
const database = process.env.DB_NAME ?? 'SmartHomeElectronicsDB'

const config = {
  connectionString:
    `Driver={ODBC Driver 17 for SQL Server};` +
    `Server=${server};` +
    `Database=${database};` +
    `Trusted_Connection=Yes;` +
    `TrustServerCertificate=Yes;` +
    `Encrypt=no;`,

  driver: 'msnodesqlv8',

  pool: {
    min: 0,
    max: 10,
    idleTimeoutMillis: 30_000,
  },
} as any

let poolPromise: Promise<sql.ConnectionPool> | undefined

export function getPool() {
  poolPromise ??= sql.connect(config)
  return poolPromise
}

export { sql }