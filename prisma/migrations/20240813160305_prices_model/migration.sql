-- CreateTable
CREATE TABLE "Prices" (
    "name" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prices_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prices_name_key" ON "Prices"("name");

-- CreateIndex
CREATE INDEX "Prices_price_idx" ON "Prices"("price");
