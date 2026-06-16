const { Client } = require('pg');
const crypto = require('crypto');
const prisma = require('../config/database');
const { indexDocument, removeDocument } = require('./embeddingService');
const logger = require('../utils/logger');

const DOCMOST_DB_URL = process.env.DOCMOST_DB_URL;
const DEFAULT_SPACE_ID = process.env.DOCMOST_DEFAULT_SPACE_ID;

// Helper function to initialize a fast, self-closing PostgreSQL connection
async function executePostgresQuery(queryText, params = []) {
  if (!DOCMOST_DB_URL) {
    throw new Error('Infrastructure Missing: DOCMOST_DB_URL environment variable is not defined.');
  }
  const client = new Client({ connectionString: DOCMOST_DB_URL });
  await client.connect();
  try {
    const res = await client.query(queryText, params);
    return res.rows;
  } finally {
    await client.end();
  }
}

// Helper to convert plain text title to a valid URL slug component
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')         // Replace spaces with -
    .replace(/[^\w\-]+/g, '')     // Remove all non-word chars
    .replace(/\-\-+/g, '-');      // Replace multiple - with single -
}

function extractTextFromContent(content) {
  if (!content) return '';
  if (typeof content === 'string') {
    try { content = JSON.parse(content); } catch { return content; }
  }
  if (content.type === 'text') return content.text || '';
  if (content.content && Array.isArray(content.content)) {
    return content.content.map(extractTextFromContent).join(' ');
  }
  return '';
}

// ─── CREATE (FLAT INJECTION BYPASS) ──────────────────────────────────────────

async function createDocmostPage({ title, content, spaceId }) {
  const targetSpaceId = spaceId || DEFAULT_SPACE_ID;
  
  if (!targetSpaceId) {
    logger.error("❌ CRITICAL ERROR: DOCMOST_DEFAULT_SPACE_ID environment variable is missing or invalid.");
    throw new Error("Cannot create page: A valid 36-character Space UUID is required.");
  }

  const generatedPageId = crypto.randomUUID(); 
  const baseSlug = slugify(title || 'untitled');
  const uniqueSlugString = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;
  const fullContent = `${title}\n\n${content}`;

  try {
    logger.info(`Bypassing premium API. Resolving workspace environment parameters...`);
    
    // STEP 1: Dynamically look up the workspace_id bound to this space to pass the constraint
    const spaceRows = await executePostgresQuery(
      `SELECT "workspace_id" FROM "spaces" WHERE "id" = $1;`, 
      [targetSpaceId]
    );

    if (spaceRows.length === 0) {
      throw new Error(`Target Space ID [${targetSpaceId}] was not found in the spaces table.`);
    }

    const workspaceId = spaceRows[0].workspace_id;
    logger.info(`Found workspace mapping match [${workspaceId}]. Injecting page payload...`);

    // Build Docmost's native structural JSON block mapping context
    const initialContentJson = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: content ? [{ type: "text", text: content }] : []
        }
      ]
    });

    // STEP 2: Insert matching your exact schema layout types
    await executePostgresQuery(`
      INSERT INTO "pages" (
        "id", "title", "content", "text_content", "slug_id", 
        "space_id", "workspace_id", "is_locked", "contributor_ids",
        "created_at", "updated_at"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, '{}', NOW(), NOW());
    `, [
      generatedPageId,       // id (uuid)
      title,                 // title (varchar)
      initialContentJson,    // content (jsonb)
      content,               // text_content (text)
      uniqueSlugString,      // slug_id (varchar)
      targetSpaceId,         // space_id (uuid)
      workspaceId            // workspace_id (uuid)
    ]);

    logger.info(`🎉 DATABASE BYPASS SUCCESS: Flat page entry established under UUID [${generatedPageId}]`);

  } catch (err) {
    logger.error(`❌ Postgres Content Injection Failed: ${err.message}`);
    throw err;
  }

  // Record tracing logs inside local application layer database tracker maps
  const doc = await prisma.docmostDocument.upsert({
    where: { docmostId: generatedPageId },
    create: {
      docmostId: generatedPageId,
      title,
      content: fullContent,
      spaceId: targetSpaceId,
      chunkCount: 0 
    },
    update: { title, content: fullContent, lastSyncedAt: new Date() },
  });

  // Vector index layout update execution through Qdrant using gemini-embedding-2
  const chunkCount = await indexDocument({
    id: `docmost_${generatedPageId}`,
    content: fullContent,
    metadata: { source: 'docmost', spaceId: targetSpaceId, docmostId: generatedPageId, title },
  });

  await prisma.docmostDocument.update({
    where: { id: doc.id },
    data: { 
      embeddingId: `docmost_${generatedPageId}`,
      chunkCount: chunkCount
    },
  });

  return { ...doc, chunkCount };
}

// ─── UPDATE (API BYPASS) ────────────────────────────────────────────────────

async function updateDocmostPage(docmostId, { title, content }) {
  const fullContent = `${title}\n\n${content}`;

  try {
    const updatedContentJson = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: content ? [{ type: "text", text: content }] : []
        }
      ]
    });

    await executePostgresQuery(`
      UPDATE "pages" 
      SET "title" = $1, "content" = $2, "text_content" = $3, "updated_at" = NOW()
      WHERE "id" = $4;
    `, [title, updatedContentJson, content, docmostId]);
    
    logger.info(`Direct database update complete for page: ${docmostId}`);
  } catch (err) {
    logger.warn(`Direct Postgres modification failed for page ${docmostId}: ${err.message}`);
  }

  const doc = await prisma.docmostDocument.update({
    where: { docmostId },
    data: { title, content: fullContent, lastSyncedAt: new Date() },
  });

  await removeDocument(`docmost_${docmostId}`);
  const chunkCount = await indexDocument({
    id: `docmost_${docmostId}`,
    content: fullContent,
    metadata: { source: 'docmost', spaceId: doc.spaceId || DEFAULT_SPACE_ID, docmostId, title },
  });

  await prisma.docmostDocument.update({
    where: { id: doc.id },
    data: { chunkCount: chunkCount }
  });

  return { ...doc, chunkCount };
}

// ─── DELETE (API BYPASS) ────────────────────────────────────────────────────

async function deleteDocmostPage(docmostId) {
  try {
    await executePostgresQuery(`DELETE FROM "pages" WHERE "id" = $1;`, [docmostId]);
    logger.info(`Direct database deletion complete for page: ${docmostId}`);
  } catch (err) {
    logger.warn(`Direct Postgres deletion failed for page ${docmostId}: ${err.message}`);
  }

  await removeDocument(`docmost_${docmostId}`);
  await prisma.docmostDocument.delete({ where: { docmostId } });
  return { deleted: true };
}

// ─── LIST / VECTOR MAP RETRIEVALS ───────────────────────────────────────────

async function listDocuments({ page = 1, limit = 50 } = {}) {
  const [total, docs] = await Promise.all([
    prisma.docmostDocument.count(),
    prisma.docmostDocument.findMany({
      orderBy: { lastSyncedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        docmostId: true,
        title: true,
        spaceId: true,
        embeddingId: true,
        chunkCount: true, 
        lastSyncedAt: true,
        updatedAt: true,
      },
    }),
  ]);
  return { docs, total, page, limit };
}

async function getDocument(docmostId) {
  return prisma.docmostDocument.findUnique({ where: { docmostId } });
}

// ─── FULL DATABASE SYNCHRONIZATION PIPELINE ─────────────────────────────────

async function syncDocmost() {
  logger.info('Initializing zero-premium direct database synchronization sequence...');
  let synced = 0;
  let errors = 0;

  try {
    // 💡 OPTIMIZED: Select 'text_content' directly if available to speed up processing strings
    const documents = await executePostgresQuery(`SELECT "id", "title", "content", "text_content", "space_id" FROM "pages";`);

    for (const doc of documents) {
      try {
        // Fall back to structural parsing if the text_content cache field happens to be empty
        const rawContentText = doc.text_content || extractTextFromContent(doc.content);
        const fullContent = `${doc.title}\n\n${rawContentText}`;

        const dbRecord = await prisma.docmostDocument.upsert({
          where: { docmostId: doc.id },
          create: { docmostId: doc.id, title: doc.title, content: fullContent, spaceId: doc.space_id, chunkCount: 0 },
          update: { title: doc.title, content: fullContent, lastSyncedAt: new Date() },
        });

        // Generates live vectors using the modern gemini-embedding-2 configuration setup
        const chunkCount = await indexDocument({
          id: `docmost_${doc.id}`,
          content: fullContent,
          metadata: { source: 'docmost', spaceId: doc.space_id, docmostId: doc.id, title: doc.title },
        });

        // 💡 BUGFIX: Targets dbRecord.id safely to prevent model tracking drop anomalies
        await prisma.docmostDocument.update({
          where: { id: dbRecord.id },
          data: { 
            embeddingId: `docmost_${doc.id}`,
            chunkCount: chunkCount
          },
        });

        synced++;
      } catch (err) {
        logger.error(`Error processing direct table sync for row ${doc.id}:`, err.message);
        errors++;
      }
    }
  } catch (globalErr) {
    logger.error(`Fatal crash in direct sync routine: ${globalErr.message}`);
    return { synced: 0, errors: 1 };
  }

  logger.info(`Database bypass synchronization update complete: ${synced} documents mapped to local tracking tables.`);
  return { synced, errors };
}

module.exports = {
  createDocmostPage,
  updateDocmostPage,
  deleteDocmostPage,
  listDocuments,
  getDocument,
  syncDocmost,
};