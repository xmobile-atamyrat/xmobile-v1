BEGIN;

-- Rebuilds Product."cachedPrice", the manat figure the storefront sorts and
-- range-filters on. Mirrors displayPriceOf: an active sale price of an in-stock
-- row first, else the display price, else priceInTmt.

-- 1. Update products that reference Prices table via [id]
-- Matches format [some-uuid]
-- Each text column is cast only behind its own CASE guard, so a value that is
-- not a number becomes NULL instead of aborting the script.
UPDATE "Product" p
SET "cachedPrice" = CASE
  -- A sale counts only on an in-stock row, above zero and below the regular
  -- price.
  WHEN v."outOfStockAt" IS NULL AND v.sale > 0 AND v.sale < v.regular
    THEN v.sale
  ELSE v.regular
END
FROM (
  SELECT
    n.id,
    n."outOfStockAt",
    n.sale,
    -- A stored zero display price counts as unset.
    CASE WHEN n.display > 0 THEN n.display ELSE n.exact END AS regular
  FROM (
    SELECT
      pr.id,
      pr."outOfStockAt",
      CASE WHEN btrim(pr."priceInTmt") ~ '^[0-9]+(\.[0-9]+)?$'
        THEN btrim(pr."priceInTmt")::double precision END AS exact,
      CASE WHEN btrim(pr."displayPriceTmt") ~ '^[0-9]+(\.[0-9]+)?$'
        THEN btrim(pr."displayPriceTmt")::double precision END AS display,
      CASE WHEN btrim(pr."salePriceTmt") ~ '^[0-9]+(\.[0-9]+)?$'
        THEN btrim(pr."salePriceTmt")::double precision END AS sale
    FROM "Prices" pr
  ) n
) v
WHERE p.price LIKE '[%]'
  AND v.id = substring(p.price, 2, length(p.price)-2)
  AND v.regular IS NOT NULL;

-- 2. Update products whose price is a legacy inline manat literal
UPDATE "Product"
SET "cachedPrice" = CAST(price AS DOUBLE PRECISION)
WHERE price NOT LIKE '[%]'
  AND price ~ '^[0-9]+(\.[0-9]+)?$';

COMMIT;
