-- CreateTable
CREATE TABLE "Analytics" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "firstEnter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEnter" TIMESTAMP(3) NOT NULL,
    "enterCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Analytics_pkey" PRIMARY KEY ("id")
);
