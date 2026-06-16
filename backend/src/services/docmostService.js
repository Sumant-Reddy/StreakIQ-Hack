const axios = require('axios');
const prisma = require('../config/database');
const { indexDocument } = require('./embeddingService');
const logger = require('../utils/logger');

const DOCMOST_URL = process.env.DOCMOST_URL || 'http://docmost:3000';
const DOCMOST_API_KEY = process.env.DOCMOST_API_KEY;

const docmostApi = axios.create({
  baseURL: `${DOCMOST_URL}/api`,
  headers: DOCMOST_API_KEY ? { 'Authorization': `Bearer ${DOCMOST_API_KEY}` } : {},
  timeout: 30000,
});

async function fetchSpaces() {
  try {
    const response = await docmostApi.get('/spaces');
    return response.data?.data || [];
  } catch (err) {
    logger.warn('Docmost: Could not fetch spaces:', err.message);
    return [];
  }
}

async function fetchDocuments(spaceId) {
  try {
    const response = await docmostApi.get(`/spaces/${spaceId}/pages`);
    return response.data?.data || [];
  } catch (err) {
    logger.warn(`Docmost: Could not fetch docs for space ${spaceId}:`, err.message);
    return [];
  }
}

async function fetchDocumentContent(pageId) {
  try {
    const response = await docmostApi.get(`/pages/${pageId}`);
    const page = response.data;
    // Extract plain text from Docmost's ProseMirror JSON content
    const content = extractTextFromContent(page.content);
    return { title: page.title, content, spaceId: page.spaceId };
  } catch (err) {
    logger.warn(`Docmost: Could not fetch page ${pageId}:`, err.message);
    return null;
  }
}

function extractTextFromContent(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (content.type === 'text') return content.text || '';
  if (content.content && Array.isArray(content.content)) {
    return content.content.map(extractTextFromContent).join(' ');
  }
  return '';
}

async function syncDocmost() {
  if (!DOCMOST_API_KEY) {
    logger.warn('Docmost sync skipped: DOCMOST_API_KEY not set');
    return { synced: 0, errors: 0 };
  }

  logger.info('Starting Docmost sync...');
  const spaces = await fetchSpaces();
  let synced = 0;
  let errors = 0;

  for (const space of spaces) {
    const documents = await fetchDocuments(space.id);

    for (const doc of documents) {
      try {
        const pageData = await fetchDocumentContent(doc.id);
        if (!pageData || !pageData.content.trim()) continue;

        const fullContent = `${pageData.title}\n\n${pageData.content}`;

        // Upsert in DB
        await prisma.docmostDocument.upsert({
          where: { docmostId: doc.id },
          create: {
            docmostId: doc.id,
            title: pageData.title,
            content: fullContent,
            spaceId: space.id,
          },
          update: {
            title: pageData.title,
            content: fullContent,
            lastSyncedAt: new Date(),
          },
        });

        // Index in Qdrant for RAG
        await indexDocument({
          id: `docmost_${doc.id}`,
          content: fullContent,
          metadata: { source: 'docmost', spaceId: space.id, docmostId: doc.id, title: pageData.title },
        });

        synced++;
      } catch (err) {
        logger.error(`Docmost: Failed to sync doc ${doc.id}:`, err.message);
        errors++;
      }
    }
  }

  logger.info(`Docmost sync complete: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

module.exports = { syncDocmost };
