-- FIND-10 impact count. READ-ONLY, aggregates only.
--
-- What it answers: how many deals were moved back to Masuk by a change that
-- named no stage (a contact name saved, a WhatsApp number repaired), between
-- the day the bug could first be triggered in Production and the day the fix
-- is deployed there.
--
-- What the data can and cannot tell. A stage move writes one row to
-- "DealStageTransition" (from, to, time) in the same transaction as the deal.
-- It does not record which fields the request carried, so an accidental
-- "<stage> -> MASUK" row looks exactly like a deliberate one. The buckets
-- below are therefore degrees of likelihood, never proof:
--
--   probable   the move skipped back over at least one stage (DEAL, KONTEN,
--              INVOICE or DIBAYAR -> MASUK), or the deal already had an
--              invoice when it was moved to MASUK. The app's buttons only go
--              one stage back; a deliberate jump like this needs a desktop
--              drag-and-drop onto the Masuk column.
--   possible   NEGO -> MASUK with no invoice: the same row the ordinary
--              "Kembali ke Masuk" button writes.
--
-- A deal reset more than once is one deal with several reset_rows; a deal
-- with rows in both buckets is counted in each.
--
-- A count of 0 in both buckets means no recorded reset in the window. It
-- does not cover a deal that was deleted afterwards (its history is deleted
-- with it).
--
-- Window. The screens that send such a change and the stage history reached
-- `main` in the same merge (b6119d2, 2026-09-06 11:35 WIB = 04:35:07 UTC),
-- so every reset in Production since then has a history row. Set window_end
-- to the time the fix is deployed to Production; until then now() is right.
--
-- Output: counts only. No brand, phone number, name, id or token is
-- selected. With very few accounts a count can still point at one person;
-- treat the result as internal.
--
-- How to run: with a read-only role, on the verified Production database,
-- as one batch. The transaction is read-only and is rolled back. Nothing
-- here repairs anything.

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '60s';

-- 1. The count.
WITH params AS (
  SELECT
    TIMESTAMPTZ '2026-09-06 04:35:07+00' AS window_start,
    now()                                AS window_end
),
resets AS (
  SELECT t."dealId", t."fromStatus", t."createdAt"
  FROM public."DealStageTransition" t
  CROSS JOIN params p
  WHERE t."toStatus" = 'MASUK'
    AND t."fromStatus" IS NOT NULL
    AND t."fromStatus" <> 'MASUK'
    AND t."createdAt" >= p.window_start
    AND t."createdAt" <  p.window_end
),
classified AS (
  SELECT
    r."dealId",
    d."userId",
    d."status" AS current_status,
    -- Invoice."createdAt" is stored without a zone, as UTC.
    EXISTS (
      SELECT 1 FROM public."Invoice" i
      WHERE i."dealId" = r."dealId"
        AND (i."createdAt" AT TIME ZONE 'UTC') <= r."createdAt"
    ) AS had_invoice,
    r."fromStatus"
  FROM resets r
  JOIN public."Deal" d ON d."id" = r."dealId"
),
bucketed AS (
  SELECT
    c.*,
    CASE
      WHEN c."fromStatus" <> 'NEGO' OR c.had_invoice THEN 'probable'
      ELSE 'possible'
    END AS bucket
  FROM classified c
)
SELECT
  bucket,
  count(*)                                                        AS reset_rows,
  count(DISTINCT "dealId")                                        AS deals,
  count(DISTINCT "userId")                                        AS accounts,
  count(DISTINCT "dealId") FILTER (WHERE had_invoice)             AS deals_with_invoice_at_reset,
  -- Still wrong today (needs a repair) versus already moved on by the owner
  -- (only the history line is left).
  count(DISTINCT "dealId") FILTER (WHERE current_status = 'MASUK')  AS deals_at_masuk_now,
  count(DISTINCT "dealId") FILTER (WHERE current_status <> 'MASUK') AS deals_moved_on_since
FROM bucketed
GROUP BY bucket
ORDER BY bucket;

-- 2. Scale, to read the count against: all deals, and all recorded moves in
--    the same window.
WITH params AS (
  SELECT
    TIMESTAMPTZ '2026-09-06 04:35:07+00' AS window_start,
    now()                                AS window_end
)
SELECT
  (SELECT count(*) FROM public."Deal")                                     AS deals_total,
  (SELECT count(*) FROM public."Deal" WHERE "status" = 'MASUK')            AS deals_at_masuk_now,
  (SELECT count(*) FROM public."DealStageTransition" t CROSS JOIN params p
    WHERE t."fromStatus" IS NOT NULL
      AND t."createdAt" >= p.window_start AND t."createdAt" < p.window_end) AS moves_in_window,
  (SELECT min(t."createdAt") FROM public."DealStageTransition" t
    WHERE t."fromStatus" IS NOT NULL)                                      AS earliest_recorded_move;

ROLLBACK;
