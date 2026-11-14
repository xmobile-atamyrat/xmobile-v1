-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Start from biggest brands first, close to the count-based order the filter
-- showed until now.
UPDATE "Brand" AS b
SET "sortOrder" = ranked.position
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "productCount" DESC, name) - 1 AS position
  FROM "Brand"
) AS ranked
WHERE b.id = ranked.id;
