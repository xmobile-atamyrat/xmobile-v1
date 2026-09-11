-- AlterTable
--
-- NULL means "not computed yet": readers fall back to priceInTmt verbatim
-- rather than rounding on the fly, so no existing price moves under a customer
-- until the dollar rate is next updated, which rewrites every row.
ALTER TABLE "Prices" ADD COLUMN "displayPriceTmt" TEXT;

-- Product."cachedPrice" switches from USD to the manat figure the storefront
-- shows, so the price filter and sort can match it directly instead of dividing
-- by the dollar rate. Backfilled because a stale USD value here silently drops
-- products out of every price range.
UPDATE "Product" AS p
SET "cachedPrice" = v.val
FROM (
  SELECT
    pr.id AS pid,
    CASE
      WHEN pr."displayPriceTmt" ~ '^[0-9]+(\.[0-9]+)?$'
        AND pr."displayPriceTmt"::double precision > 0
        THEN pr."displayPriceTmt"::double precision
      WHEN pr."priceInTmt" ~ '^[0-9]+(\.[0-9]+)?$'
        THEN pr."priceInTmt"::double precision
      ELSE NULL
    END AS val
  FROM "Prices" pr
) AS v(pid, val)
WHERE p."deletedAt" IS NULL
  AND v.val IS NOT NULL
  AND (p."price" = v.pid OR p."price" LIKE '%[' || v.pid || ']%');
