-- CreateTable
CREATE TABLE "OrderMaterial" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "requiredQty" DECIMAL(12,2) NOT NULL,
    "consumedQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderMaterial_inventoryItemId_idx" ON "OrderMaterial"("inventoryItemId");

-- CreateIndex
CREATE INDEX "OrderMaterial_orderId_idx" ON "OrderMaterial"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderMaterial_orderId_inventoryItemId_key" ON "OrderMaterial"("orderId", "inventoryItemId");

-- AddForeignKey
ALTER TABLE "OrderMaterial" ADD CONSTRAINT "OrderMaterial_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderMaterial" ADD CONSTRAINT "OrderMaterial_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderMaterial" ADD CONSTRAINT "OrderMaterial_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
