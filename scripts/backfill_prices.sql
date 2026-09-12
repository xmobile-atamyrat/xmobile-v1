BEGIN;

-- Rebuilds Product."cachedPrice", the manat figure the storefront sorts and
-- range-filters on. Falls back to priceInTmt where no display price is stored,
-- matching displayPriceOf.

-- 1. Update products that reference Prices table via [id]
-- Matches format [some-uuid]
UPDATE "Product" p
SET "cachedPrice" = CASE
  WHEN pr."displayPriceTmt" ~ '^[0-9]+(\.[0-9]+)?$'
    AND pr."displayPriceTmt"::double precision > 0
    THEN pr."displayPriceTmt"::double precision
  ELSE CAST(pr."priceInTmt" AS DOUBLE PRECISION)
END
FROM "Prices" pr
WHERE p.price LIKE '[%]'
  AND pr.id = substring(p.price, 2, length(p.price)-2)
  AND pr."priceInTmt" ~ '^[0-9]+(\.[0-9]+)?$';

-- 2. Update products whose price is a legacy inline manat literal
UPDATE "Product"
SET "cachedPrice" = CAST(price AS DOUBLE PRECISION)
WHERE price NOT LIKE '[%]'
  AND price ~ '^[0-9]+(\.[0-9]+)?$';

COMMIT;
