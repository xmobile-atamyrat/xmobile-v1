DROP INDEX "Color_name_key";

DROP INDEX "Color_hex_key";

ALTER TABLE "Color" ADD COLUMN "brandId" TEXT;

CREATE UNIQUE INDEX "Color_brandId_name_key" ON "Color"("brandId", "name");

CREATE UNIQUE INDEX "Color_brandId_hex_key" ON "Color"("brandId", "hex");

ALTER TABLE "Color" ADD CONSTRAINT "Color_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
