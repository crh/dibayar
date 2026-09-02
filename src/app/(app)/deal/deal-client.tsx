"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DealRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";
import { useLanguage } from "@/components/language-switcher";
import { DealBoard } from "@/components/deals/deal-board";
import { StageFilter } from "@/components/deals/stage-filter";
import { AddDealDialog } from "@/components/deals/add-deal-dialog";
import { DealForm, EMPTY_DEAL_FORM, type DealFormState } from "@/components/deals/deal-form";
import { isStageValue } from "@/components/deals/deal-stages";

type DealClientProps = {
  initialDeals: DealRecord[];
  initialInvoices: InvoiceRecord[];
  initialDialogOpen: boolean;
};

// Fired after our own history.pushState calls (chip clicks below), which the
// browser gives no native event for -- unlike popstate (back/forward), which
// is native and needs no help.
const STAGE_FILTER_LOCATION_EVENT = "dealclient:stagefilterlocationchange";

function readStageFromTahap(tahap: string | null): DealRecord["status"] | null {
  return isStageValue(tahap) ? tahap : null;
}

function readStageFilterFromWindow(): DealRecord["status"] | null {
  return readStageFromTahap(new URLSearchParams(window.location.search).get("tahap"));
}

function subscribeToStageFilterLocation(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(STAGE_FILTER_LOCATION_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(STAGE_FILTER_LOCATION_EVENT, onStoreChange);
  };
}

export default function DealClient({
  initialDeals,
  initialInvoices,
  initialDialogOpen,
}: DealClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, t } = useLanguage();
  const [deals, setDeals] = useState(initialDeals);
  const [invoices, setInvoices] = useState(initialInvoices);
  // deals/invoices don't depend on `tahap` at all (DealBoard filters the
  // already-loaded list client-side), so routing a real Next.js navigation
  // through this param on every filter chip click would force a wasted full
  // server round trip -- re-running auth() and both list queries. Chip
  // clicks (handleStageFilterChange below) therefore move the browser URL
  // with a raw history.pushState, bypassing the Next.js router entirely.
  //
  // That means the URL can change through two independent mechanisms this
  // component must agree with: raw pushState/popstate (which the Next.js
  // router's own `searchParams` doesn't see) and real Next.js navigations,
  // e.g. TopBar's "New Invoice"/"New Deal" links (which do update
  // `searchParams`, and keep this component mounted since only the search
  // param changes). Deriving `stageFilter` from `searchParams` misses the
  // first; caching a local copy and re-syncing it by diffing against a
  // "last seen" value (tried previously) is fragile, because a chip click
  // can move the *browser URL* without moving whatever the diff is
  // comparing against, so a later real navigation that happens to land back
  // on that stale comparison value is silently treated as a no-op.
  //
  // Instead, `window.location.search` -- the actual, single, authoritative
  // record of "what does the browser's address bar say right now" -- is
  // read fresh on every render via useSyncExternalStore, which both chip
  // clicks and popstate can invalidate directly (no comparison, nothing to
  // alias). useSearchParams() above is still called: it subscribes this
  // component to the Next.js router, so a same-route Link/router navigation
  // still causes a re-render here, by which point Next has already updated
  // `window.location` for real. getServerSnapshot falls back to it because
  // `window` doesn't exist during SSR.
  const stageFilter = useSyncExternalStore(
    subscribeToStageFilterLocation,
    readStageFilterFromWindow,
    () => readStageFromTahap(searchParams.get("tahap")),
  );
  const [isDialogOpen, setIsDialogOpen] = useState(initialDialogOpen);
  const [form, setForm] = useState<DealFormState>(EMPTY_DEAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDealId, setPendingDealId] = useState<string | null>(null);
  const hasStrippedDialogParam = useRef(false);

  // The dialog-open URL flag (?tambah=1) from the global "+ Deal" action is a
  // one-shot trigger, not durable state: strip it once so reload/back don't
  // reopen the dialog on their own.
  useEffect(() => {
    if (initialDialogOpen && !hasStrippedDialogParam.current) {
      hasStrippedDialogParam.current = true;
      router.replace(stageFilter ? `/deal?tahap=${stageFilter}` : "/deal");
    }
  }, [initialDialogOpen, router, stageFilter]);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setError(null);
    setForm(EMPTY_DEAL_FORM);
  }, []);

  function handleStageFilterChange(next: DealRecord["status"] | null) {
    // History API only (not router.push): a real Next.js navigation here
    // would re-run the server component's auth() and data queries for a
    // param that never changes what they return. pushState (not replace)
    // still gives each filter choice its own history entry so back/forward
    // can step through it. The dispatched event tells the
    // useSyncExternalStore subscription above to re-read the URL it just
    // moved -- pushState itself fires no event browsers listen for.
    window.history.pushState(null, "", next ? `/deal?tahap=${next}` : "/deal");
    window.dispatchEvent(new Event(STAGE_FILTER_LOCATION_EVENT));
  }

  async function handleStageChange(dealId: string, status: DealRecord["status"]) {
    const previousDeal = deals.find((deal) => deal.id === dealId);
    if (!previousDeal || previousDeal.status === status) return; // no-op: already there, or unknown deal

    setError(null);
    setSuccessMessage(null);
    setPendingDealId(dealId);
    // Optimistic: move it immediately, keep the prior record to restore on failure.
    setDeals((current) => current.map((deal) => (deal.id === dealId ? { ...deal, status } : deal)));

    try {
      const response = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error("dashboard.dealError");
      setDeals((current) => current.map((deal) => (deal.id === dealId ? payload.deal : deal)));
    } catch {
      setDeals((current) => current.map((deal) => (deal.id === dealId ? previousDeal : deal)));
      setError("dashboard.dealError");
    } finally {
      setPendingDealId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          feeIdr: Number(form.feeIdr),
          deadline: form.deadline || undefined,
          contactName: form.contactName || undefined,
          paymentTerms: form.paymentTerms || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error("dashboard.saveError");
      setDeals((current) => [payload.deal, ...current]);
      setForm(EMPTY_DEAL_FORM);
      setSuccessMessage("dashboard.dealSaved");
      setIsDialogOpen(false);
    } catch {
      setError("dashboard.saveError");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateInvoice(dealId: string) {
    setError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, withholdingTaxType: "NONE" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error("dashboard.invoiceError");
      setInvoices((current) => [payload.invoice, ...current]);
      setSuccessMessage("dashboard.invoiceCreated");
    } catch {
      setError("dashboard.invoiceError");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-5 py-6 min-[640px]:px-8 min-[640px]:py-8">
      {successMessage ? (
        <div role="status" aria-live="polite" className="rounded-md border border-paid/30 bg-paid-tint px-4 py-3 text-[14px] font-semibold text-paid">
          {t(successMessage)}
        </div>
      ) : null}
      {error && !isDialogOpen ? <p role="alert" className="ds-small text-overdue">{t(error)}</p> : null}

      <StageFilter stageFilter={stageFilter} t={t} onChange={handleStageFilterChange} />

      <DealBoard
        deals={deals}
        invoices={invoices}
        language={language}
        t={t}
        pendingDealId={pendingDealId}
        isSaving={isSaving}
        stageFilter={stageFilter}
        onStageChange={handleStageChange}
        onCreateInvoice={handleCreateInvoice}
      />

      <AddDealDialog
        open={isDialogOpen}
        onClose={closeDialog}
        title={t("deal.addDealTitle")}
        description={t("dashboard.addDealHint")}
        closeLabel={t("dashboard.close")}
      >
        {error && isDialogOpen ? <p role="alert" className="mb-3 ds-small text-overdue">{t(error)}</p> : null}
        <DealForm formId="tambah-deal-form" form={form} onChange={setForm} onSubmit={handleSubmit} isSaving={isSaving} t={t} />
      </AddDealDialog>
    </main>
  );
}
