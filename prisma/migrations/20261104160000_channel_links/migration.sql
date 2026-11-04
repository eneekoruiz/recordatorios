-- CreateTable
CREATE TABLE "ChannelLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subjectHash" TEXT,
    "challengeHash" TEXT,
    "challengeExpiresAt" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL,

    CONSTRAINT "ChannelLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelEvent" (
    "key" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" INTEGER,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelEvent_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelLink_challengeHash_key" ON "ChannelLink"("challengeHash");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelLink_userId_channel_key" ON "ChannelLink"("userId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelLink_channel_subjectHash_key" ON "ChannelLink"("channel", "subjectHash");

-- CreateIndex
CREATE INDEX "ChannelEvent_linkId_idx" ON "ChannelEvent"("linkId");

-- AddForeignKey
ALTER TABLE "ChannelLink" ADD CONSTRAINT "ChannelLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelEvent" ADD CONSTRAINT "ChannelEvent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ChannelLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
