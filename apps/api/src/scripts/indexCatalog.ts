import { indexProductCatalog } from '../services/ragIndexService.js'

void (async () => {
  try {
    const result = await indexProductCatalog()
    console.log(`Indexed ${result.indexedProducts} products into ${result.collectionName}.`)
  } catch (error) {
    console.error('Catalog indexing failed.', error)
    process.exitCode = 1
  }
})()
