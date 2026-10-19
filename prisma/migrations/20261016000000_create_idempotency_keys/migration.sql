-- #53: a create repeated with the same key returns the stored row instead of
-- writing a second one. Additive only: nullable columns (existing rows keep
-- NULL, and NULLs never collide in a unique index).

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Deal_userId_idempotencyKey_key" ON "Deal"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_userId_idempotencyKey_key" ON "Invoice"("userId", "idempotencyKey");
