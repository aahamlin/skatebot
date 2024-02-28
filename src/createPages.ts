import { opendirSync, readFileSync, statSync } from 'fs'
import * as path from 'path'
import { MongoClient } from 'mongodb'
import type { OptionalId } from 'mongodb'
import 'dotenv/config'

import createDebug from 'debug'
import type { PageDoc } from './pages'
const debug = createDebug('pages')

// eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
const mongoAtlasUri: string = process.env.MONGO_ATLAS_URI as string

async function readPages (): Promise<PageDoc[]> {
    debug(`reading pages directory`)
    const pages: PageDoc[] = []
    const dir = opendirSync(path.join(__dirname, '/../pages'))
    for await (const f of dir) {
        const content = readFileSync(f.path, 'utf-8')
        const pageDoc = {
            name: f.name,
            path: f.path,
            lastModified: statSync(f.path).mtime,
            content
        }
        pages.push(pageDoc)
    }
    debug(`read ${pages.length} pages`)
    return pages
}

async function storePages (pages: PageDoc[]): Promise<number> {
    const client = new MongoClient(mongoAtlasUri)
    const dbName = 'skatebot'
    const collectionName = 'pages'
    const collection = client.db(dbName).collection<OptionalId<PageDoc>>(collectionName)

    debug(`Inserting ${pages.length} pages`)
    const result = await collection.insertMany(pages)

    await client.close()

    if (!result.acknowledged) throw new Error('page writes not acknowledged')
    debug(`Inserted ${result.insertedCount} pages`)
    return result.insertedCount
}

async function main (): Promise<void> {
    // read pages directory
    const pages = await readPages()
    // upload markdown files to mongodb
    await storePages(pages)
}

main().catch((error) => { console.error(error); process.exit(1) })
