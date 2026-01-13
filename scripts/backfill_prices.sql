BEGIN;

-- 1. Update products that reference Prices table via [id]
-- Matches format [some-uuid]
-- Joins with Prices table to get the actual price value
UPDATE "Product" p
SET "cachedPrice" = CAST(pr.price AS DOUBLE PRECISION)
FROM "Prices" pr
WHERE p.price LIKE '[%]'
  AND pr.id = substring(p.price, 2, length(p.price)-2)
  AND pr.price ~ '^[0-9]+(\.[0-9]+)?$';

-- 2. Update products that have direct numeric prices
-- Matches simple numbers like "100" or "100.50"
UPDATE "Product"
SET "cachedPrice" = CAST(price AS DOUBLE PRECISION)
WHERE price NOT LIKE '[%]'
  AND price ~ '^[0-9]+(\.[0-9]+)?$';

COMMIT;
