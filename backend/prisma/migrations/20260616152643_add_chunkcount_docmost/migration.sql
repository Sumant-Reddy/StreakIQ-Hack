-- AlterTable
ALTER TABLE `DocmostDocument` ADD COLUMN `chunkCount` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `User` MODIFY `language` ENUM('EN', 'HI', 'TE', 'TA', 'KN') NOT NULL DEFAULT 'EN';
