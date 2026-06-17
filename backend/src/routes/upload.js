const router = require('express').Router();
const path = require('path');
const fs = require('fs').promises; // Using promises version for cleaner async local writes
const fsSync = require('fs');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { isS3Configured, uploadToS3, getPresignedUrl } = require('../services/s3Service');
const logger = require('../utils/logger');

// Ensure local uploads fallback directory exists safely on boot
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fsSync.existsSync(uploadsDir)) {
  fsSync.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Force memory storage globally.
 * This guarantees `req.file.buffer` is ALWAYS populated when a file hits the endpoint,
 * leaving the decision to stream to S3 or write to local disk dynamically at execution time.
 */
const storage = multer.memoryStorage();

const ALLOWED_EXT = /\.(mp4|webm|mov|avi|mkv|mp3|wav|ogg|aac|m4a|pdf|ppt|pptx|doc|docx|jpg|jpeg|png|gif|webp|svg)$/i;
const IMG_EXT = /\.(jpg|jpeg|png|gif|webp|svg)$/i;

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // Keep an eye on RAM consumption for large files
  fileFilter: (req, file, cb) => {
    if (ALLOWED_EXT.test(path.extname(file.originalname))) return cb(null, true);
    cb(new Error('Unsupported file type'));
  },
});

const thumbUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (IMG_EXT.test(path.extname(file.originalname))) return cb(null, true);
    cb(new Error('Image files only for thumbnails'));
  },
});

function detectFileType(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (/\.(mp4|webm|mov|avi|mkv)$/.test(ext)) return 'video';
  if (/\.(mp3|wav|ogg|aac|m4a)$/.test(ext)) return 'audio';
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/.test(ext)) return 'image';
  if (/\.(ppt|pptx)$/.test(ext)) return 'presentation';
  if (/\.(pdf|doc|docx)$/.test(ext)) return 'document';
  return 'media';
}

/**
 * Handles the storage destination routing dynamically per request execution loop.
 */
async function resolveUrl(req, file, { courseId, fileType }) {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  // Dynamic check: guarantees environment configuration state is parsed up to date
  if (isS3Configured()) {
    logger.info(`Routing file upload directly to AWS S3: ${file.originalname}`);
    const result = await uploadToS3(file.buffer, file.originalname, file.mimetype, { courseId, fileType });
    return { url: result.url, filename: result.filename, s3Key: result.key };
  }

  // Local File System Fallback Engine (Runs if S3 is down/unconfigured)
  logger.warn(`S3 not active. Processing fallback write to local storage for: ${file.originalname}`);
  const ext = path.extname(file.originalname).toLowerCase();
  const uniqueFilename = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
  const destinationPath = path.join(uploadsDir, uniqueFilename);

  // Write the memory buffer manually to disk
  await fs.writeFile(destinationPath, file.buffer);

  // Use BACKEND_URL so the file is served from the API server, not the frontend dev server
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  return {
    url: `${backendUrl}/uploads/${uniqueFilename}`,
    filename: uniqueFilename,
    s3Key: null,
  };
}

// POST /api/upload — general file (video, PDF, PPT, audio, image, doc)
router.post('/upload', authenticate, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const courseId = req.body.courseId || req.query.courseId || null;
  const fileType = detectFileType(req.file);
  
  const { url, filename, s3Key } = await resolveUrl(req, req.file, { courseId, fileType });

  logger.info(`Upload completed [${s3Key ? 'S3' : 'local'}]: ${req.file.originalname} → ${url}`);

  res.json({
    url,
    filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
    fileType,
    storage: s3Key ? 's3' : 'local',
    ...(s3Key && { s3Key }),
  });
}));

// POST /api/upload/thumbnail — images only, thumbnail/ folder under course
router.post('/upload/thumbnail', authenticate, thumbUpload.single('thumbnail'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const courseId = req.body.courseId || req.query.courseId || null;
  const { url, filename, s3Key } = await resolveUrl(req, req.file, { courseId, fileType: 'thumbnail' });

  logger.info(`Thumbnail upload completed [${s3Key ? 'S3' : 'local'}]: ${req.file.originalname}`);

  res.json({
    url,
    filename,
    originalName: req.file.originalname,
    size: req.file.size,
    storage: s3Key ? 's3' : 'local',
    ...(s3Key && { s3Key }),
  });
}));

// GET /api/presign?key=courses/5/video/abc.mp4&expires=3600
router.get('/presign', authenticate, asyncHandler(async (req, res) => {
  if (!isS3Configured()) {
    return res.status(400).json({ error: 'S3 not configured — presigned URLs unavailable' });
  }
  
  const { key, expires } = req.query;
  if (!key || typeof key !== 'string' || key.includes('..')) {
    return res.status(400).json({ error: 'Invalid key' });
  }

  // Security boundary validation rule: limit targets to designated root bucket namespace strings
  if (!key.startsWith('courses/')) {
    return res.status(403).json({ error: 'Access denied: Target location falls outside authorized scope.' });
  }

  const expiresIn = Math.min(Number(expires) || 3600, 86400); // max 24 h
  const url = await getPresignedUrl(key, expiresIn);
  
  res.json({ url, key, expiresIn, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() });
}));

module.exports = router;