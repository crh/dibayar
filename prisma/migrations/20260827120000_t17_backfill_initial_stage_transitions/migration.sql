-- T-17 data-integrity repair: every Deal must have one deterministic initial
-- DealStageTransition, including deals that have no transition history at all.
--
-- toStatus is reconstructed from the deal's own earliest recorded
-- DealStageTransition's fromStatus when one exists -- that is real, already-
-- durable history, and using it avoids stamping the deal's *current*
-- status onto a synthetic "created directly at X" row for a deal that has
-- since moved through other stages, which would otherwise read as
-- self-contradictory next to the deal's own later, genuine transition rows
-- (verified against a disposable local target: a deal with a real MASUK ->
-- NEGO row and no initial row previously backfilled toStatus = NEGO,
-- implying it was created at NEGO -- directly contradicting the real row
-- showing it only reached NEGO from MASUK later). Only a deal with no
-- transition history at all falls back to the current Deal.status, since
-- nothing else is known about it.
--
-- The Deal.createdAt value is interpreted as the app's UTC wall-clock
-- convention and explicitly converted to TIMESTAMPTZ. The NOT EXISTS guard
-- makes this safe to re-run without duplicate initial rows.
INSERT INTO "DealStageTransition" ("id", "dealId", "fromStatus", "toStatus", "createdAt")
SELECT gen_random_uuid()::text,
  d."id",
  NULL,
  COALESCE(
    (
      SELECT t."fromStatus"
      FROM "DealStageTransition" t
      WHERE t."dealId" = d."id"
      ORDER BY t."createdAt" ASC
      LIMIT 1
    ),
    d."status"
  ),
  (d."createdAt" AT TIME ZONE 'UTC')
FROM "Deal" d
WHERE NOT EXISTS (
  SELECT 1
  FROM "DealStageTransition" t
  WHERE t."dealId" = d."id"
    AND t."fromStatus" IS NULL
);
