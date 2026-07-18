-- CreateTable
CREATE TABLE "InvoiceShare" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceShare_invoiceId_key" ON "InvoiceShare"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceShare_tokenHash_key" ON "InvoiceShare"("tokenHash");

-- AddForeignKey
ALTER TABLE "InvoiceShare" ADD CONSTRAINT "InvoiceShare_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
