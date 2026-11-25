-- AlterTable
--
-- Optional sale price in manat, typed by an admin. NULL means no sale; the
-- normal price columns are left untouched. Whether a stored value is an active
-- sale (a number above 0 and below the shown price) is decided by
-- salePriceOf in src/pages/lib/priceDisplay.ts.
ALTER TABLE "Prices" ADD COLUMN "salePriceTmt" TEXT;
