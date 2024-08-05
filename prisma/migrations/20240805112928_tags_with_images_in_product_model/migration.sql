/*
  Warnings:

  - You are about to drop the column `tagImages` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `Product` table. All the data in the column will be lost.
  - Added the required column `tagsWithImages` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "tagImages",
DROP COLUMN "tags",
ADD COLUMN     "tagsWithImages" JSONB NOT NULL;
