/*
  Warnings:

  - You are about to drop the column `CreatedByUserID` on the `Events` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Events" DROP CONSTRAINT "Events_CreatedByUserID_fkey";

-- AlterTable
ALTER TABLE "Events" DROP COLUMN "CreatedByUserID";
