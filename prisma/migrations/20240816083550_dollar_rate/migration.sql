-- CreateTable
CREATE TABLE "DollarRate" (
    "rate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DollarRate_pkey" PRIMARY KEY ("rate")
);

-- CreateIndex
CREATE UNIQUE INDEX "DollarRate_rate_key" ON "DollarRate"("rate");
