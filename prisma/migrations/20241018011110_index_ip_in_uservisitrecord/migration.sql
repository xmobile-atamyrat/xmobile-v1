-- DropIndex
DROP INDEX "UserVisitRecord_createdAt_idx";

-- CreateIndex
CREATE INDEX "UserVisitRecord_createdAt_ip_idx" ON "UserVisitRecord"("createdAt", "ip");
