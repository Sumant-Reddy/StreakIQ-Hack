-- AlterTable: add S3 key fields for file uploads
ALTER TABLE `Course` ADD COLUMN `thumbnailS3Key` VARCHAR(191) NULL;
ALTER TABLE `Module` ADD COLUMN `s3Key` VARCHAR(191) NULL;
