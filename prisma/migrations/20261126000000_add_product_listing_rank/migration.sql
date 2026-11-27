ALTER TABLE "Product" ADD COLUMN "listingRank" INTEGER;

CREATE UNIQUE INDEX "Product_listingRank_key" ON "Product"("listingRank");
