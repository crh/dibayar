-- T-17 data-integrity repair: every Deal must have one deterministic initial
-- DealStageTransition, including deals that have no transition history at all.
-- The current Deal.status is the only authoritative status available for an
-- old row, so it is used as toStatus. The Deal.createdAt value is interpreted
-- as the app's UTC wall-clock convention and explicitly converted to TIMESTAMPTZ.
-- The NOT EXISTS guard makes this safe to re-run without duplicate initial rows.
INSERT INTO "DealStageTransition" ("id", "dealId", "fromStatus", "toStatus", "createdAt")
SELECT gen_random_uuid()::text,
  d."id",
  NULL,
  d."status",
  (d."createdAt" AT TIME ZONE 'UTC')
FROM "Deal" d
WHERE NOT EXISTS (
  SELECT 1
  FROM "DealStageTransition" t
  WHERE t."dealId" = d."id"
    AND t."fromStatus" IS NULL
);
