CREATE TABLE "UserNotificationRead" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "notificationKey" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserNotificationRead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserNotificationRead_userId_notificationKey_key" ON "UserNotificationRead"("userId", "notificationKey");
CREATE INDEX "UserNotificationRead_userId_readAt_idx" ON "UserNotificationRead"("userId", "readAt");
ALTER TABLE "UserNotificationRead" ADD CONSTRAINT "UserNotificationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
