-- Decision A (issue #55, approved 2026-10-18): an issued or shared invoice's
-- document stops following later deal and Settings edits. Additive only: a
-- new table and two enums; no existing column changes, so the previous app
-- version keeps working against this schema (it simply never reads the new
-- table). See prisma/schema.prisma (InvoiceSnapshot) and
-- src/lib/invoice-snapshot.ts.

-- CreateEnum
CREATE TYPE "InvoiceSnapshotProvenance" AS ENUM ('CAPTURED_ON_ISSUE', 'RECONSTRUCTED_ON_MIGRATION', 'RECONSTRUCTED_LATE');

-- CreateEnum
CREATE TYPE "InvoiceSnapshotTrigger" AS ENUM ('STATUS_CHANGE', 'SHARE_LINK', 'DOCUMENT_READ', 'MIGRATION');

-- CreateTable
CREATE TABLE "InvoiceSnapshot" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "contactName" TEXT,
    "scope" TEXT NOT NULL,
    "paymentTerms" TEXT,
    "issuerSettingsPresent" BOOLEAN NOT NULL,
    "issuerName" TEXT,
    "issuerAddress" TEXT,
    "issuerWhatsapp" TEXT,
    "issuerEmail" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountHolder" TEXT,
    "provenance" "InvoiceSnapshotProvenance" NOT NULL,
    "trigger" "InvoiceSnapshotTrigger" NOT NULL,
    "sourceDealUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceSettingsUpdatedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSnapshot_invoiceId_key" ON "InvoiceSnapshot"("invoiceId");

-- AddForeignKey
ALTER TABLE "InvoiceSnapshot" ADD CONSTRAINT "InvoiceSnapshot_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A snapshot is written once and never rewritten: reject every UPDATE at
-- the database, whatever the caller. DELETE stays possible so deleting an
-- invoice or an account still cascades.
CREATE FUNCTION "InvoiceSnapshot_reject_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'InvoiceSnapshot rows are immutable' USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "InvoiceSnapshot_immutable"
BEFORE UPDATE ON "InvoiceSnapshot"
FOR EACH ROW EXECUTE FUNCTION "InvoiceSnapshot_reject_update"();

-- One-time backfill for invoices already exposed before this migration: every
-- invoice that has left DRAFT, and every invoice with a share row (active or
-- expired -- a Draft with a link was already reachable by the brand). The
-- original text was never stored, so these rows are reconstructed from the
-- deal and Settings values current right now and are labelled
-- RECONSTRUCTED_ON_MIGRATION, never CAPTURED_ON_ISSUE. A share revoked before
-- this migration left no trace, so a Draft that was shared and then revoked
-- is not detected; it is frozen at its next exposure like any other Draft.
-- A missing UserSettings row stays null (issuerSettingsPresent = false):
-- nothing is invented. ON CONFLICT DO NOTHING makes a re-run a no-op.
INSERT INTO "InvoiceSnapshot" (
  "id", "invoiceId", "brand", "contactName", "scope", "paymentTerms",
  "issuerSettingsPresent", "issuerName", "issuerAddress", "issuerWhatsapp", "issuerEmail",
  "bankName", "bankAccountNumber", "bankAccountHolder",
  "provenance", "trigger", "sourceDealUpdatedAt", "sourceSettingsUpdatedAt"
)
SELECT
  gen_random_uuid()::text, i."id", d."brand", d."contactName", d."scope", d."paymentTerms",
  s."id" IS NOT NULL, s."issuerName", s."issuerAddress", s."issuerWhatsapp", s."issuerEmail",
  s."bankName", s."bankAccountNumber", s."bankAccountHolder",
  'RECONSTRUCTED_ON_MIGRATION', 'MIGRATION', d."updatedAt", s."updatedAt"
FROM "Invoice" i
JOIN "Deal" d ON d."id" = i."dealId" AND d."userId" = i."userId"
LEFT JOIN "UserSettings" s ON s."userId" = i."userId"
WHERE i."status" <> 'DRAFT'
   OR EXISTS (SELECT 1 FROM "InvoiceShare" sh WHERE sh."invoiceId" = i."id")
ON CONFLICT ("invoiceId") DO NOTHING;
