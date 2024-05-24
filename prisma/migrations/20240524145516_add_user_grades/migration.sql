-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FREE', 'ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "grade" "UserRole" NOT NULL DEFAULT 'FREE';
