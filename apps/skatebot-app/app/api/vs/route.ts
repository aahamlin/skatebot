import { MongoDBAtlasVectorSearch } from 'langchain/vectorstores/mongodb_atlas'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { MongoClient } from 'mongodb'

// eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
const mongoAtlasUri: string = process.env.MONGO_ATLAS_URI as string

export async function POST(req: Request) {
    const client = new MongoClient(mongoAtlasUri)
    const dbName = 'skatebot'
    const collectionName = 'embeddings'
    const collection = client.db(dbName).collection(collectionName)

    const question = await req.text()

    const vectorStore = new MongoDBAtlasVectorSearch(
        new OpenAIEmbeddings({
            modelName: "text-embedding-ada-002",
            stripNewLines: true
        }), {
            collection,
            indexName: "vector_index",
            textKey: "text",
            embeddingKey: "embedding"
        }
    )

    const retriever = vectorStore.asRetriever({
        searchType: "mmr",
        searchKwargs: {
            fetchK: 20,
            lambda: 0.1
        }
    })

    const retrieverOutput = await retriever.getRelevantDocuments(question)

    await client.close()

    return Response.json(retrieverOutput)
}