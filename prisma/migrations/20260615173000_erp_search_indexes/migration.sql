-- Non-destructive indexes for global search, filters, and store-scoped exports.
CREATE INDEX "Lead_name_idx" ON "Lead"("name");
CREATE INDEX "Customer_email_idx" ON "Customer"("email");
CREATE INDEX "Customer_storeId_idx" ON "Customer"("storeId");
CREATE INDEX "InventoryItem_name_idx" ON "InventoryItem"("name");
CREATE INDEX "Purchase_vendorName_idx" ON "Purchase"("vendorName");
CREATE INDEX "Purchase_storeId_idx" ON "Purchase"("storeId");
