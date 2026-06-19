-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "measurements" JSONB;

-- AlterTable
ALTER TABLE "OrderMaterial" ADD COLUMN     "sendToDyer" BOOLEAN NOT NULL DEFAULT false;
