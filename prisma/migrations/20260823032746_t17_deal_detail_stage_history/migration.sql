-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "contactName" TEXT;

-- CreateTable
CREATE TABLE "DealStageTransition" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "fromStatus" "DealStatus",
    "toStatus" "DealStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealStageTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealStageTransition_dealId_createdAt_idx" ON "DealStageTransition"("dealId", "createdAt");

-- AddForeignKey
ALTER TABLE "DealStageTransition" ADD CONSTRAINT "DealStageTransition_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
