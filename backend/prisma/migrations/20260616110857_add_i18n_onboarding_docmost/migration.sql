/*
  Warnings:

  - A unique constraint covering the columns `[inviteToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Course` ADD COLUMN `descriptionHi` TEXT NULL,
    ADD COLUMN `descriptionTe` TEXT NULL,
    ADD COLUMN `isMandatory` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `titleHi` VARCHAR(191) NULL,
    ADD COLUMN `titleTe` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Module` ADD COLUMN `titleHi` VARCHAR(191) NULL,
    ADD COLUMN `titleTe` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `inviteExpiry` DATETIME(3) NULL,
    ADD COLUMN `inviteToken` VARCHAR(191) NULL,
    ADD COLUMN `language` ENUM('EN', 'HI', 'TE') NOT NULL DEFAULT 'EN',
    ADD COLUMN `region` VARCHAR(191) NULL,
    ADD COLUMN `status` ENUM('ACTIVE', 'INVITED', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `storeCode` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `DocmostDocument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `docmostId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `spaceId` VARCHAR(191) NULL,
    `embeddingId` VARCHAR(191) NULL,
    `lastSyncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DocmostDocument_docmostId_key`(`docmostId`),
    INDEX `DocmostDocument_spaceId_idx`(`spaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `User_inviteToken_key` ON `User`(`inviteToken`);
