const { QdrantClient } = require('@qdrant/js-client-rest');
const OpenAI = require('openai');
const logger = require('../utils/logger');

const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'yami_knowledge';
const VECTOR_SIZE = 1536;

let qdrantClient;
let openaiClient;

const getQdrant = () => {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({ url: process.env.QDRANT_URL || 'http://localhost:6333' });
  }
  return qdrantClient;
};

const getOpenAI = () => {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
};

async function ensureCollection() {
  try {
    const client = getQdrant();
    const collections = await client.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);
    if (!exists) {
      await client.createCollection(COLLECTION_NAME, {
        vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
      });
      logger.info(`Qdrant collection "${COLLECTION_NAME}" created`);
    }
  } catch (err) {
    logger.warn('Qdrant not available:', err.message);
  }
}

async function createEmbedding(text) {
  const openai = getOpenAI();
  if (!openai) {
    return Array.from({ length: VECTOR_SIZE }, () => Math.random() * 2 - 1);
  }
  const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text.substring(0, 8000) });
  return resp.data[0].embedding;
}

async function indexDocument({ id, content, metadata }) {
  try {
    await ensureCollection();
    const chunks = chunkText(content, 500);
    const client = getQdrant();

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await createEmbedding(chunks[i]);
      await client.upsert(COLLECTION_NAME, {
        points: [{
          id: `${id}_${i}`,
          vector: embedding,
          payload: { documentId: id, chunkIndex: i, text: chunks[i], ...metadata },
        }],
      });
    }
    logger.info(`Indexed document ${id} with ${chunks.length} chunks`);
  } catch (err) {
    logger.warn('Vector indexing failed (non-critical):', err.message);
  }
}

async function searchSimilar(query, { courseId, limit = 5 } = {}) {
  try {
    await ensureCollection();
    const embedding = await createEmbedding(query);
    const filter = courseId ? { must: [{ key: 'courseId', match: { value: courseId } }] } : undefined;

    const results = await getQdrant().search(COLLECTION_NAME, {
      vector: embedding,
      limit,
      filter,
      with_payload: true,
    });

    return results.map(r => r.payload.text).join('\n\n');
  } catch (err) {
    logger.warn('Vector search failed (non-critical):', err.message);
    return '';
  }
}

function chunkText(text, wordsPerChunk = 500) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
  }
  return chunks.length ? chunks : [text];
}

module.exports = { indexDocument, searchSimilar, ensureCollection };
