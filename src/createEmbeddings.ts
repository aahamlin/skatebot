import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { MongoDBAtlasVectorSearch } from 'langchain/vectorstores/mongodb_atlas'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import type { Document } from 'langchain/dist/document'
import { MongoClient } from 'mongodb'
import type { OptionalId } from 'mongodb'
import type { PageDoc } from './pages'
import 'dotenv/config'

import createDebug from 'debug'
const debug = createDebug('embeddings')

// eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
const mongoAtlasUri: string = process.env.MONGO_ATLAS_URI as string

async function fetchPages (): Promise<PageDoc[]> {
    debug(`fetching pages`)
    const pages: PageDoc[] = []
    const client = new MongoClient(mongoAtlasUri)
    const dbName = 'skatebot'
    const collectionName = 'pages'
    const collection = client.db(dbName).collection<OptionalId<PageDoc>>(collectionName)

    const findResult = collection.find()
    for await (const doc of findResult) {
        pages.push(doc)
    }

    await client.close()
    debug(`fetched ${pages.length} pages`)
    return pages
}

// async function fetchDocuments (): Promise<string[]> {
//     debug(`fetching: ${srcUrls.join(', ')}`)
//     const documents = await Promise.all(srcUrls.map(async (url) => {
//         const doc = await fetch(url).then(async (res) => await res.text())
//         debug(`page content: ${doc}`)
//         return doc
//     }))
//     debug(`fetched ${documents.length} documents`)
//     return documents
// }

async function createEncodedDocuments (srcDocs: string[]): Promise<Array<Document<Record<string, any>>>> {
    debug(`creating embeddings from ${srcDocs.length} documents`)
    const splitter = RecursiveCharacterTextSplitter.fromLanguage('markdown',
        { chunkSize: 500, chunkOverlap: 50 })

    const output = await splitter.createDocuments(srcDocs)
    return output
}

async function storeEmbeddings (encodedDocs: Array<Document<Record<string, any>>>): Promise<void> {
    debug(`storing embeddings to mongo`)
    const client = new MongoClient(mongoAtlasUri)
    const dbName = 'skatebot'
    const collectionName = 'embeddings'
    const collection = client.db(dbName).collection(collectionName)

    await MongoDBAtlasVectorSearch.fromDocuments(
        encodedDocs,
        new OpenAIEmbeddings(),
        {
            collection,
            indexName: 'vector_index',
            textKey: 'text',
            embeddingKey: 'embedding'
        }
    )

    await client.close()
}

async function main (): Promise<void> {
    const srcDocs = await fetchPages()
    const contents = await createEncodedDocuments(srcDocs.map((doc) => doc.content))
    await storeEmbeddings(contents)
}

main().catch((error) => { console.log(error); process.exit(1) })
