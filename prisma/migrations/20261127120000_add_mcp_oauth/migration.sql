CREATE TABLE "McpGrant" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "accessIssuedAt" TIMESTAMP(3) NOT NULL,
    "accessExpiresAt" TIMESTAMP(3) NOT NULL,
    "accessUsedAt" TIMESTAMP(3),
    "previousAccessTokenHash" TEXT,
    "previousAccessExpiresAt" TIMESTAMP(3),
    "refreshTokenHash" TEXT NOT NULL,
    "refreshGeneration" TIMESTAMP(3) NOT NULL,
    "previousRefreshTokenHash" TEXT,
    "authCodeHash" TEXT NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "McpGrant_accessTokenHash_key" ON "McpGrant"("accessTokenHash");

CREATE UNIQUE INDEX "McpGrant_previousAccessTokenHash_key" ON "McpGrant"("previousAccessTokenHash");

CREATE UNIQUE INDEX "McpGrant_authCodeHash_key" ON "McpGrant"("authCodeHash");

CREATE INDEX "McpGrant_userId_idx" ON "McpGrant"("userId");

ALTER TABLE "McpGrant" ADD CONSTRAINT "McpGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
