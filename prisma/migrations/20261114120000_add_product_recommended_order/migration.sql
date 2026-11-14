ALTER TABLE "Product" ADD COLUMN "recommendedOrder" INTEGER;

CREATE INDEX "Product_recommendedOrder_idx" ON "Product"("recommendedOrder");
