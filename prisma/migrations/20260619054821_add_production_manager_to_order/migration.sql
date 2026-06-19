-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "productionManagerId" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_productionManagerId_fkey" FOREIGN KEY ("productionManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
