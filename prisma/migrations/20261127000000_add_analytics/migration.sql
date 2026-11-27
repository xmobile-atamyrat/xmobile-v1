-- Analytics: raw events (kept 90 days) and daily rollups (kept forever).
-- See docs/analytics-design.md.

-- CreateEnum
CREATE TYPE "AnalyticsPlatform" AS ENUM ('WEB', 'APP');

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" BIGSERIAL NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "visitorId" UUID NOT NULL,
    "sessionId" UUID,
    "userId" TEXT,
    "entityId" TEXT,
    "platform" "AnalyticsPlatform" NOT NULL,
    "locale" VARCHAR(2) NOT NULL,
    "props" JSONB,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsDaily" (
    "day" DATE NOT NULL,
    "metric" TEXT NOT NULL,
    "dimension" TEXT NOT NULL DEFAULT '',
    "dimensionValue" TEXT NOT NULL DEFAULT '',
    "value" BIGINT NOT NULL,

    CONSTRAINT "AnalyticsDaily_pkey" PRIMARY KEY ("metric","day","dimension","dimensionValue")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_occurredAt_idx" ON "AnalyticsEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_name_occurredAt_idx" ON "AnalyticsEvent"("name", "occurredAt");
