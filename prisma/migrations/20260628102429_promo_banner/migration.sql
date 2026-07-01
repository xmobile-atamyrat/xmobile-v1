-- CreateTable
CREATE TABLE "PromoBanner" (
    "id" TEXT NOT NULL,
    "imgUrls" JSONB NOT NULL,
    "redirectProductId" TEXT,
    "redirectCategoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoBanner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromoBanner_isActive_sortOrder_idx" ON "PromoBanner"("isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "PromoBanner" ADD CONSTRAINT "PromoBanner_redirectProductId_fkey" FOREIGN KEY ("redirectProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoBanner" ADD CONSTRAINT "PromoBanner_redirectCategoryId_fkey" FOREIGN KEY ("redirectCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
