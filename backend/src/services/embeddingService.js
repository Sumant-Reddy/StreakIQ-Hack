const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');
const logger = require('../utils/logger');

const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'yami_knowledge';
const VECTOR_SIZE = 3072; // gemini-embedding-001 / gemini-embedding-2 native dimension

let genAI;

// Direct REST client for Qdrant — replaces @qdrant/js-client-rest which has a
// Node 26 native-fetch incompatibility ("invalid onError method").
const qdrantBase = () => (process.env.QDRANT_URL || 'http://localhost:6333').replace(/\/$/, '');

async function qFetch(method, path, body) {
  const res = await fetch(`${qdrantBase()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Qdrant ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

const getGenAI = () => {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) { logger.error('GEMINI_API_KEY not set — embeddings will use random vectors'); return null; }
    genAI = new GoogleGenerativeAI(key);
  }
  return genAI;
};

async function ensureCollection() {
  try {
    const { result } = await qFetch('GET', '/collections');
    const existing = (result?.collections || []).find(c => c.name === COLLECTION_NAME);
    if (existing) {
      const info = await qFetch('GET', `/collections/${COLLECTION_NAME}`);
      const currentSize = info.result?.config?.params?.vectors?.size;
      if (currentSize && currentSize !== VECTOR_SIZE) {
        logger.warn(`Collection size mismatch (${currentSize} vs ${VECTOR_SIZE}). Recreating...`);
        await qFetch('DELETE', `/collections/${COLLECTION_NAME}`);
      } else {
        return;
      }
    }
    await qFetch('PUT', `/collections/${COLLECTION_NAME}`, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    });
    logger.info(`Qdrant collection "${COLLECTION_NAME}" created (${VECTOR_SIZE} dims)`);
  } catch (err) {
    logger.error(`Qdrant collection init failed: ${err.message}`);
    throw err;
  }
}

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
    const model = ai.getGenerativeModel({ model: 'gemini-embedding-001' });
    const result = await model.embedContent({
      content: { parts: [{ text: cleanText }] },
      taskType,
    });
    const values = result?.embedding?.values;
    if (values && values.length > 0) {
      return Array.from(values);
    }
    logger.warn(`gemini-embedding-001 returned empty vector. Falling back.`);
  } catch (err) {
    try {
      const model = ai.getGenerativeModel({ model: 'gemini-embedding-2' });
      const result = await model.embedContent({
        content: { parts: [{ text: cleanText }] },
        taskType,
      });
      const values = result?.embedding?.values;
      if (values && values.length > 0) {
        return Array.from(values);
      }
    } catch (err2) {
      logger.warn(`gemini-embedding-2 also failed: ${err2.message}`);
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

    const cleanMeta = {};
    for (const [k, v] of Object.entries(metadata)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') cleanMeta[k] = v;
    }

    let indexed = 0;
    for (let i = 0; i < chunks.length; i++) {
      const vector = await createEmbedding(chunks[i], 'RETRIEVAL_DOCUMENT');
      await qFetch('PUT', `/collections/${COLLECTION_NAME}/points?wait=true`, {
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
    await qFetch('POST', `/collections/${COLLECTION_NAME}/points/delete`, {
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
    const results = [];

    if (courseId) {
      const courseRes = await qFetch('POST', `/collections/${COLLECTION_NAME}/points/search`, {
        vector,
        limit: 4,
        filter: { must: [{ key: 'courseId', match: { value: Number(courseId) } }] },
        with_payload: true,
      });
      results.push(...(courseRes.result || []));

      if (includeDocmost) {
        const docRes = await qFetch('POST', `/collections/${COLLECTION_NAME}/points/search`, {
          vector,
          limit: 3,
          filter: { must: [{ key: 'source', match: { value: 'docmost' } }] },
          with_payload: true,
        });
        results.push(...(docRes.result || []));
      }
    } else {
      const allRes = await qFetch('POST', `/collections/${COLLECTION_NAME}/points/search`, {
        vector,
        limit,
        with_payload: true,
      });
      results.push(...(allRes.result || []));
    }

    const seen = new Set();
    const unique = results
      .filter(r => {
        const k = r.payload?.text;
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return r.score > 0.3;
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
  return {
    vectorSize: vec.length,
    isGeminiLive: !!process.env.GEMINI_API_KEY,
    sample: vec.slice(0, 3),
  };
}

module.exports = { indexDocument, removeDocument, searchSimilar, ensureCollection, testEmbedding };
