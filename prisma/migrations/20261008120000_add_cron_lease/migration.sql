CREATE TABLE "CronLease" (
    "key" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronLease_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "CronLease_expiresAt_idx" ON "CronLease"("expiresAt");