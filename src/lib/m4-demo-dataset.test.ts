import { describe, expect, it } from "vitest";
import { summarizeMonthlyIncome } from "./income-summary";
import { DUE_SOON_WINDOW_DAYS, selectAttentionInvoices } from "./invoice-date-status";
import { createInvoice, type InvoiceCreateDb, type InvoiceRecord, type InvoiceTransactionClient } from "./invoices";
import {
  M4_DEMO_DEALS,
  M4_DEMO_STAGING_ENDPOINT,
  buildM4DemoInvoiceInput,
  checkM4DemoTarget,
  jakartaDateOffset,
  jakartaDateOnlyOffset,
} from "./m4-demo-dataset";

const stagingPooled = `postgresql://u:p@${M4_DEMO_STAGING_ENDPOINT}-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`;
const stagingDirect = `postgresql://u:p@${M4_DEMO_STAGING_ENDPOINT}.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`;

describe("checkM4DemoTarget", () => {
  it("accepts the Neon staging endpoint (pooled or direct) with the confirm flag", () => {
    expect(checkM4DemoTarget(stagingPooled, "staging")).toEqual({ ok: true, host: M4_DEMO_STAGING_ENDPOINT });
    expect(checkM4DemoTarget(stagingDirect, "staging")).toEqual({ ok: true, host: M4_DEMO_STAGING_ENDPOINT });
  });

  it("refuses any other endpoint, including a Production-like one", () => {
    const other = stagingPooled.replace(M4_DEMO_STAGING_ENDPOINT, "ep-some-other-endpoint");
    expect(checkM4DemoTarget(other, "staging").ok).toBe(false);
    expect(checkM4DemoTarget("postgresql://u:p@127.0.0.1:55432/dibayar_test", "staging").ok).toBe(false);
    // A staging id embedded later in the hostname is not the endpoint.
    expect(checkM4DemoTarget(`postgresql://u:p@evil.${M4_DEMO_STAGING_ENDPOINT}.example/neondb`, "staging").ok).toBe(false);
  });

  it("refuses without the confirm flag, with override params, or with a non-Postgres URL", () => {
    expect(checkM4DemoTarget(stagingPooled, undefined).ok).toBe(false);
    expect(checkM4DemoTarget(stagingPooled, "production").ok).toBe(false);
    expect(checkM4DemoTarget(`${stagingPooled}&host=elsewhere`, "staging").ok).toBe(false);
    expect(checkM4DemoTarget(stagingPooled.replace("postgresql:", "mysql:"), "staging").ok).toBe(false);
    expect(checkM4DemoTarget(undefined, "staging").ok).toBe(false);
    expect(checkM4DemoTarget("not a url", "staging").ok).toBe(false);
  });
});

describe("jakartaDateOffset", () => {
  it("offsets from the Jakarta calendar date, not the UTC one", () => {
    // 2026-09-30T18:00Z is already 2026-10-01 01:00 in Jakarta.
    const now = new Date("2026-09-30T18:00:00Z");
    expect(jakartaDateOffset(now, 0).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(jakartaDateOffset(now, -4).toISOString()).toBe("2026-09-27T00:00:00.000Z");
  });
});

describe("jakartaDateOnlyOffset", () => {
  it("names the Jakarta calendar day as yyyy-mm-dd, matching jakartaDateOffset", () => {
    // 16:59:59Z is 23:59:59 Jakarta; 17:00Z is already the next Jakarta day.
    expect(jakartaDateOnlyOffset(new Date("2026-09-30T16:59:59Z"), 0)).toBe("2026-09-30");
    expect(jakartaDateOnlyOffset(new Date("2026-09-30T17:00:00Z"), 0)).toBe("2026-10-01");
    expect(jakartaDateOnlyOffset(new Date("2026-09-30T17:00:00Z"), 31)).toBe("2026-11-01");
    expect(jakartaDateOnlyOffset(new Date("2026-09-30T17:00:00Z"), -1)).toBe("2026-09-30");
  });
});

describe("buildM4DemoInvoiceInput", () => {
  // A fake that runs the real createInvoice (and so the strict public
  // invoiceCreateSchema) and records what would be written.
  function makeCreateDb() {
    const created: Array<{ dueDate: Date | null }> = [];
    const tx = {
      $queryRaw: async () => [{ lastSequence: 1 }],
      invoice: {
        create: async ({ data }: { data: { dueDate: Date | null } }) => {
          created.push(data);
          return { id: `inv-${created.length}`, ...data };
        },
      },
    } as unknown as InvoiceTransactionClient;
    const db: InvoiceCreateDb = {
      deal: { findFirst: async () => ({ id: "deal-1", userId: "demo", feeIdr: 1_000_000, deadline: null }) },
      $transaction: async (fn) => fn(tx),
    } as InvoiceCreateDb;
    return { db, created };
  }

  // Just before Jakarta midnight and just after it, where a UTC/Jakarta
  // confusion would shift the stored day.
  it.each(["2026-09-30T16:59:59Z", "2026-09-30T17:00:00Z"])(
    "every demo invoice passes createInvoice's strict schema with no day shift (now=%s)",
    async (nowIso) => {
      const now = new Date(nowIso);
      for (const demo of M4_DEMO_DEALS) {
        if (!demo.invoice) continue;
        const input = buildM4DemoInvoiceInput("deal-1", demo.invoice, now);
        expect(input.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        const { db, created } = makeCreateDb();
        await expect(createInvoice(db, "demo", input)).resolves.not.toBeNull();
        // Stored as UTC midnight of exactly the Jakarta day the dataset means.
        expect(created[0].dueDate?.toISOString()).toBe(jakartaDateOffset(now, demo.invoice.dueOffsetDays).toISOString());
      }
    },
  );

  it("regression: the previous Date payload is rejected by the strict schema", async () => {
    const { db, created } = makeCreateDb();
    const now = new Date("2026-09-30T07:00:00Z");
    await expect(
      createInvoice(db, "demo", { dealId: "deal-1", withholdingTaxType: "NONE", dueDate: jakartaDateOffset(now, 7) }),
    ).rejects.toThrow();
    expect(created).toHaveLength(0);
  });
});

describe("M4_DEMO_DEALS", () => {
  const now = new Date("2026-09-30T07:00:00Z");

  // Mirrors what scripts/m4-demo-data.ts produces: every invoice is created
  // "now" and ends at the last status in its path.
  const invoices: InvoiceRecord[] = M4_DEMO_DEALS.flatMap((deal, index) =>
    deal.invoice
      ? [{
          id: `inv-${index}`,
          userId: "demo",
          dealId: deal.key,
          number: `INV-${index}`,
          subtotalIdr: deal.input.feeIdr,
          withholdingTaxType: deal.invoice.withholdingTaxType,
          status: deal.invoice.statusPath.at(-1)!,
          dueDate: jakartaDateOffset(now, deal.invoice.dueOffsetDays),
          createdAt: now,
          updatedAt: now,
        }]
      : [],
  );

  it("covers the stages the moderator flow needs", () => {
    expect(M4_DEMO_DEALS.length).toBeGreaterThanOrEqual(3);
    expect(M4_DEMO_DEALS.length).toBeLessThanOrEqual(5);
    const finalStages = M4_DEMO_DEALS.map((deal) => deal.stages.at(-1));
    expect(finalStages).toEqual(expect.arrayContaining(["NEGO", "KONTEN", "INVOICE", "DIBAYAR"]));
    const nego = M4_DEMO_DEALS.find((deal) => deal.stages.at(-1) === "NEGO");
    expect(nego?.invoice).toBeUndefined();
  });

  it("uses only invoice transitions the app allows, starting from DRAFT", () => {
    const allowed: Record<string, string[]> = { DRAFT: ["SENT"], SENT: ["DUE", "OVERDUE", "PAID"], DUE: ["OVERDUE", "PAID"], OVERDUE: ["PAID"] };
    for (const deal of M4_DEMO_DEALS) {
      if (!deal.invoice) continue;
      const path = deal.invoice.statusPath;
      expect(path[0]).toBe("DRAFT");
      for (let i = 1; i < path.length; i += 1) expect(allowed[path[i - 1]]).toContain(path[i]);
    }
  });

  it("shows one overdue and one due-soon invoice in the follow-up queue", () => {
    const { overdue, dueSoon } = selectAttentionInvoices(invoices, now);
    expect(overdue.map((invoice) => invoice.dealId)).toEqual(["overdue"]);
    expect(dueSoon.map((invoice) => invoice.dealId)).toEqual(["due-soon"]);
    expect(dueSoon[0].daysUntilDue).toBeLessThanOrEqual(DUE_SOON_WINDOW_DAYS);
  });

  it("produces a monthly summary that excludes the draft and is net of estimated PPh", () => {
    const summary = summarizeMonthlyIncome(invoices, now);
    expect(summary.invoiceCount).toBe(3);
    expect(summary.grossIdr).toBe(4_000_000 + 2_500_000 + 1_750_000);
    expect(summary.withholdingIdr).toBe(80_000 + 125_000);
    expect(summary.netIdr).toBe(8_045_000);
  });

  it("uses both PPh types and a no-PPh invoice", () => {
    const types = new Set(M4_DEMO_DEALS.flatMap((deal) => (deal.invoice ? [deal.invoice.withholdingTaxType] : [])));
    expect(types).toEqual(new Set(["NONE", "PPH21", "PPH23"]));
  });
});
