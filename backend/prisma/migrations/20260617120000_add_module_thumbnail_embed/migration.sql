-- Module thumbnail fields
ALTER TABLE `Module` ADD COLUMN `thumbnail` VARCHAR(191) NULL;
ALTER TABLE `Module` ADD COLUMN `thumbnailS3Key` VARCHAR(191) NULL;
-- Add EMBED content type
ALTER TABLE `Module` MODIFY COLUMN `contentType` ENUM('VIDEO','PDF','PPT','SOP','ARTICLE','EMBED') NOT NULL;
