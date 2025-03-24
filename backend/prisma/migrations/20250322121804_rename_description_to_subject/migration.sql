/*
  Warnings:

  - You are about to drop the column `description` on the `Classroom` table. All the data in the column will be lost.
  - You are about to drop the `attachments` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_announcementId_fkey";

-- AlterTable
ALTER TABLE "Classroom" DROP COLUMN "description",
ADD COLUMN     "subject" TEXT;

-- DropTable
DROP TABLE "attachments";
