const { QdrantClient } = require('@qdrant/js-client-rest');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');
const logger = require('../utils/logger');

const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'yami_knowledge';
const VECTOR_SIZE = 768;

let qdrantClient;
let genAI;

const getQdrant = () => {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({ url: process.env.QDRANT_URL || 'http://yami-qdrant:6333' });
  }
  return qdrantClient;
};

const getGenAI = () => {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) { logger.error('GEMINI_API_KEY not set — embeddings will use random vectors'); return null; }
    genAI = new GoogleGenerativeAI(key);
  }
  return genAI;
};

async function ensureCollection() {
  const client = getQdrant();
  try {
    const collections = await client.getCollections();
    const existing = collections.collections.find(c => c.name === COLLECTION_NAME);
    if (existing) {
      const info = await client.getCollection(COLLECTION_NAME);
      const currentSize = info.config?.params?.vectors?.size;
      if (currentSize && currentSize !== VECTOR_SIZE) {
        logger.warn(`Collection size mismatch (${currentSize} vs ${VECTOR_SIZE}). Recreating...`);
        await client.deleteCollection(COLLECTION_NAME);
      } else {
        return;
      }
    }
    await client.createCollection(COLLECTION_NAME, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    });
    logger.info(`Qdrant collection "${COLLECTION_NAME}" created (${VECTOR_SIZE} dims)`);
  } catch (err) {
    logger.error(`Qdrant collection init failed: ${err.message}`);
    throw err;
  }
}

// Returns normalized random vector as safe fallback
function randomVector(size = VECTOR_SIZE) {
  const v = Array.from({ length: size }, () => Math.random() * 2 - 1);
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map(x => x / mag);
}

async function createEmbedding(text, taskType = 'RETRIEVAL_DOCUMENT') {
  const cleanText = (text || '').replace(/\s+/g, ' ').trim().substring(0, 8000);
  if (!cleanText) return randomVector();

  const ai = getGenAI();
  if (!ai) return randomVector();

  try {
    const model = ai.getGenerativeModel({ model: 'text-embedding-004' });
    // embedContent accepts: { content, taskType, outputDimensionality } as top-level properties
    const result = await model.embedContent({
      content: { parts: [{ text: cleanText }] },
      taskType,
      outputDimensionality: VECTOR_SIZE,
    });
    const values = result?.embedding?.values;
    if (values && values.length === VECTOR_SIZE) {
      return Array.from(values);
    }
    logger.warn(`Gemini returned unexpected vector size: ${values?.length}. Falling back.`);
  } catch (err) {
    // Try embedding-001 as fallback
    try {
      const model = ai.getGenerativeModel({ model: 'embedding-001' });
      const result = await model.embedContent({
        content: { parts: [{ text: cleanText }] },
      });
      const values = result?.embedding?.values;
      if (values && values.length > 0) {
        // embedding-001 returns 768 dims too
        return Array.from(values).slice(0, VECTOR_SIZE);
      }
    } catch (err2) {
      logger.warn(`embedding-001 also failed: ${err2.message}`);
    }
    logger.error(`Gemini embedding failed: ${err.message} — using random vector`);
  }
  return randomVector();
}

function chunkText(text, wordsPerChunk = 300, overlap = 50) {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  if (words.length <= wordsPerChunk) return [text.trim()];
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
    i += wordsPerChunk - overlap;
  }
  return chunks;
}

function toUUID(str) {
  return crypto.createHash('md5').update(str).digest('hex')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}

async function indexDocument({ id, content, metadata = {} }) {
  try {
    await ensureCollection();
    const chunks = chunkText(content || '', 300, 50);
    if (!chunks.length) { logger.warn(`No content to index for ${id}`); return 0; }

    const client = getQdrant();
    const cleanMeta = {};
    for (const [k, v] of Object.entries(metadata)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') cleanMeta[k] = v;
    }

    let indexed = 0;
    for (let i = 0; i < chunks.length; i++) {
      const vector = await createEmbedding(chunks[i], 'RETRIEVAL_DOCUMENT');
      await client.upsert(COLLECTION_NAME, {
        wait: true,
        points: [{
          id: toUUID(`${id}_chunk_${i}`),
          vector,
          payload: {
            documentId: String(id),
            chunkIndex: i,
            text: chunks[i],
            source: cleanMeta.source || 'unknown',
            title: cleanMeta.title || String(id),
            ...cleanMeta,
          },
        }],
      });
      indexed++;
    }
    logger.info(`Indexed ${indexed} chunks for document ${id}`);
    return indexed;
  } catch (err) {
    logger.error(`indexDocument failed for ${id}: ${err.message}`);
    return 0;
  }
}

async function removeDocument(idPrefix) {
  try {
    const client = getQdrant();
    await client.delete(COLLECTION_NAME, {
      filter: { must: [{ key: 'documentId', match: { value: String(idPrefix) } }] },
    });
  } catch (err) {
    logger.warn(`removeDocument failed: ${err.message}`);
  }
}

async function searchSimilar(query, { courseId, limit = 6, includeDocmost = true } = {}) {
  try {
    await ensureCollection();
    const vector = await createEmbedding(query, 'RETRIEVAL_QUERY');
    const client = getQdrant();
    const results = [];

    if (courseId) {
      // Search course-specific content
      const courseHits = await client.search(COLLECTION_NAME, {
        vector,
        limit: 4,
        filter: { must: [{ key: 'courseId', match: { value: Number(courseId) } }] },
        with_payload: true,
      });
      results.push(...courseHits);

      // Also search docmost for general knowledge
      if (includeDocmost) {
        const docHits = await client.search(COLLECTION_NAME, {
          vector,
          limit: 3,
          filter: { must: [{ key: 'source', match: { value: 'docmost' } }] },
          with_payload: true,
        });
        results.push(...docHits);
      }
    } else {
      // No courseId: search ALL indexed content (course + docmost)
      const allHits = await client.search(COLLECTION_NAME, {
        vector,
        limit,
        with_payload: true,
      });
      results.push(...allHits);
    }

    // Deduplicate and rank by score
    const seen = new Set();
    const unique = results
      .filter(r => {
        const k = r.payload?.text;
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return r.score > 0.3; // filter very low relevance
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      context: unique.map(r => r.payload.text).join('\n\n---\n\n'),
      sources: [...new Set(unique.map(r => r.payload.title || r.payload.source).filter(Boolean))],
      chunks: unique.map(r => ({
        text: r.payload.text,
        source: r.payload.title || r.payload.source,
        score: r.score,
        courseId: r.payload.courseId,
      })),
    };
  } catch (err) {
    logger.warn(`searchSimilar failed: ${err.message}`);
    return { context: '', sources: [], chunks: [] };
  }
}

async function testEmbedding() {
  const vec = await createEmbedding('test diamond grading query');
  const isRandom = vec.every((v, i) => i === 0 || v !== vec[i - 1]); // random vecs have no two equal adjacent
  return {
    vectorSize: vec.length,
    isGeminiLive: !!process.env.GEMINI_API_KEY,
    sample: vec.slice(0, 3),
  };
}

module.exports = { indexDocument, removeDocument, searchSimilar, ensureCollection, testEmbedding };
