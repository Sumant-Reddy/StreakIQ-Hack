const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

let s3Client;

function getS3() {
  if (!s3Client) {
    // Clean strings to eliminate accidental whitespace or carriage returns (\r)
    const accessKey = (process.env.AWS_ACCESS_KEY_ID || '').trim();
    const secretKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();
    const regionName = (process.env.AWS_REGION || 'ap-south-1').trim();

    if (!accessKey || !secretKey) {
      logger.error("S3 Initialization Failed: Keys are empty strings after trimming.");
      throw new Error("Missing cleaned AWS credentials.");
    }

    s3Client = new S3Client({
      region: regionName,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });
  }
  return s3Client;
}

function isS3Configured() {
  return !!(
    process.env.AWS_ACCESS_KEY_ID && 
    process.env.AWS_SECRET_ACCESS_KEY && 
    process.env.AWS_BUCKET_NAME
  );
}

function getPublicUrl(key) {
  const bucket = (process.env.AWS_BUCKET_NAME || '').trim();
  const region = (process.env.AWS_REGION || 'ap-south-1').trim();
  if (process.env.AWS_CDN_URL) return `${process.env.AWS_CDN_URL.trim()}/${key}`;
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

async function uploadToS3(fileBuffer, originalName, mimeType, { courseId, fileType = 'media' } = {}) {
  const ext = path.extname(originalName).toLowerCase();
  const filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
  
  // Format target key hierarchy
  const key = courseId
    ? `courses/${courseId}/${fileType}/${filename}`
    : `uploads/${fileType}/${filename}`;

  const bucketName = (process.env.AWS_BUCKET_NAME || '').trim();

  // Validate buffer integrity before sending
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error("S3 Upload Failed: Provided payload body is not a valid binary buffer.");
  }

  await getS3().send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  }));

  const url = getPublicUrl(key);
  logger.info(`Uploaded to S3 successfully: ${key}`);
  return { url, key, filename };
}

async function deleteFromS3(key) {
  try {
    const bucketName = (process.env.AWS_BUCKET_NAME || '').trim();
    await getS3().send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }));
    logger.info(`Deleted from S3: ${key}`);
  } catch (err) {
    logger.warn(`S3 delete failed for ${key}: ${err.message}`);
  }
}

async function getPresignedUrl(key, expiresIn = 3600) {
  const bucketName = (process.env.AWS_BUCKET_NAME || '').trim();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  return getSignedUrl(getS3(), command, { expiresIn });
}

module.exports = { uploadToS3, deleteFromS3, isS3Configured, getPublicUrl, getPresignedUrl };