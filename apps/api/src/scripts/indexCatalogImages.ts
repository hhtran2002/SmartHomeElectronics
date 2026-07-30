import 'dotenv/config'
import { getPool } from '../config/database.js'
import {
  indexProductImageCatalog,
  indexProductImages,
} from '../services/imageSearchService.js'

void (async () => {
  try {
    const requestedProductId = process.argv[2] === undefined
      ? null
      : Number(process.argv[2])

    if (
      requestedProductId !== null
      && (!Number.isInteger(requestedProductId) || requestedProductId <= 0)
    ) {
      throw new Error('ProductId must be a positive integer.')
    }

    const result = requestedProductId === null
      ? await indexProductImageCatalog()
      : await indexProductImages(requestedProductId)
    console.log(JSON.stringify(result, null, 2))
    const pool = await getPool()
    await pool.close()
  } catch (error) {
    console.error('Catalog image indexing failed.', error)
    process.exitCode = 1
  }
})()
