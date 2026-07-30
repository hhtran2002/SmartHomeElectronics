import 'dotenv/config'
import { getPool } from '../config/database.js'
import { indexProductImageCatalog } from '../services/imageSearchService.js'

void (async () => {
  try {
    const result = await indexProductImageCatalog()
    console.log(JSON.stringify(result, null, 2))
    const pool = await getPool()
    await pool.close()
  } catch (error) {
    console.error('Catalog image indexing failed.', error)
    process.exitCode = 1
  }
})()
