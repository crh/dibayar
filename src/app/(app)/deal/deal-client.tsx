"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DealRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";
import { useLanguage } from "@/components/language-switcher";
import { DealBoard } from "@/components/deals/deal-board";
import { StageFilter } from "@/components/deals/stage-filter";
import { AddDealDialog } from "@/components/deals/add-deal-dialog";
import {
  DEAL_FORM_FIELDS,
  DealForm,
  EMPTY_DEAL_FORM,
  dealFormErrorsFromServer,
  readDealFormFields,
  validateDealForm,
  type DealFormErrors,
  type DealFormState,
} from "@/components/deals/deal-form";
import { isStageValue } from "@/components/deals/deal-stages";
import { bodyField, findCreatedDeal, findCreatedInvoice, mutationErrorKey, readList, sendMutation } from "@/lib/mutation";

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
  // still causes a re-render here -- but Next updates its router context
  // (and re-renders this component) one tick *before* it commits the actual
  // `window.history` change, so the render triggered by a fresh
  // `searchParams` value can still read stale `window.location.search`
  // (verified: the mixed chip+Link sequences below reproduce this race
  // every time without the effect below). `window.location` has always
  // settled by the next effect flush, so re-dispatch the same invalidation
  // event used for pushState once `searchParams` itself changes -- this
  // asks useSyncExternalStore to re-read the now-correct URL instead of
  // trusting the racy render. getServerSnapshot falls back to `searchParams`
  // because `window` doesn't exist during SSR.
  const stageFilter = useSyncExternalStore(
    subscribeToStageFilterLocation,
    readStageFilterFromWindow,
    () => readStageFromTahap(searchParams.get("tahap")),
  );
  // Skip the mount run: hydration already has a correct, settled URL, so
  // there's nothing to resync yet -- only a *later* searchParams change
  // (a real router navigation landing after mount) can hit the race above.
  const isMountedSearchParamsEffect = useRef(false);
  useEffect(() => {
    if (!isMountedSearchParamsEffect.current) {
      isMountedSearchParamsEffect.current = true;
      return;
    }
    window.dispatchEvent(new Event(STAGE_FILTER_LOCATION_EVENT));
  }, [searchParams]);
  const [isDialogOpen, setIsDialogOpen] = useState(initialDialogOpen);
  const [form, setForm] = useState<DealFormState>(EMPTY_DEAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<DealFormErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDealId, setPendingDealId] = useState<string | null>(null);
  const hasStrippedDialogParam = useRef(false);
  const dealFormRef = useRef<HTMLFormElement>(null);
  // Set when a create's outcome is unknown (no answer, dropped connection,
  // gateway page): it may have been stored, so the next attempt checks the
  // server first instead of sending it again (#53).
  const dealCreateUnconfirmed = useRef(false);
  const invoiceCreateUnconfirmed = useRef(new Set<string>());

  // FIND-13: ?tambah=1 arrives from the server with the dialog already open,
  // so on a slow connection someone can type into it before this component's
  // script has run. React leaves that text in the fields when it takes the
  // page over, but `form` still says every field is empty, and the next
  // render (the effect below causes one at once) would write that emptiness
  // back over what was typed. So, once, before anything re-renders, take
  // what the fields hold as the form's state. A layout effect, not an
  // effect: it has to run before the effects below. When the dialog is
  // opened from inside the app the fields were just created from `form`,
  // and this changes nothing.
  useLayoutEffect(() => {
    const formElement = dealFormRef.current;
    if (!formElement) return;
    setForm((current) => readDealFormFields(formElement, current));
  }, []);

  // The dialog-open URL flag (?tambah=1) from the global "+ Deal" action is a
  // one-shot trigger, not durable state: strip it once so reload/back don't
  // reopen the dialog on their own.
  //
  // isDialogOpen must be explicitly set here, not just seeded via
  // useState(initialDialogOpen) above: that initial value is only consulted
  // on this component's very first mount. "+ Deal" is a same-route Link
  // (only ?tambah=1 changes), so an already-mounted DealClient (the user is
  // already on /deal and clicks it) re-renders with a new initialDialogOpen
  // prop but keeps its existing isDialogOpen state -- without this call the
  // dialog silently never opens, the URL flickers to ?tambah=1 and instantly
  // back, and it looks like the button does nothing.
  //
  // The filter to preserve after stripping is read from `searchParams`
  // (Next's own router-reactive value, settled in the same render as
  // `initialDialogOpen`), not `stageFilter` (the window.location-derived
  // external store above, which a same-render click can still read as stale
  // -- see the long comment on stageFilter itself for why that lag exists).
  // ?tambah=1 only ever arrives via a real Next.js navigation, never the raw
  // pushState chip clicks use, so searchParams is always exactly this
  // navigation's own params -- no staleness possible here.
  //
  // hasStrippedDialogParam must reset once initialDialogOpen goes back to
  // false (i.e. once our own router.replace above has taken effect and
  // page.tsx re-derives the prop with no ?tambah=1): otherwise, since this
  // ref never unmounts between "+ Deal" clicks, a second click while already
  // on /deal would flip initialDialogOpen true -> false -> true again but
  // the guard would still read "already stripped" from the first click and
  // silently no-op, leaving the dialog closed.
  useEffect(() => {
    if (!initialDialogOpen) {
      hasStrippedDialogParam.current = false;
      return;
    }
    if (hasStrippedDialogParam.current) return;
    hasStrippedDialogParam.current = true;
    setIsDialogOpen(true);
    const tahapToPreserve = readStageFromTahap(searchParams.get("tahap"));
    router.replace(tahapToPreserve ? `/deal?tahap=${tahapToPreserve}` : "/deal");
  }, [initialDialogOpen, router, searchParams]);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setError(null);
    setFieldErrors({});
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
      const result = await sendMutation(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const saved = result.kind === "ok" ? bodyField<DealRecord>(result.body, "deal") : undefined;
      if (saved) {
        setDeals((current) => current.map((deal) => (deal.id === dealId ? saved : deal)));
        return;
      }
      if (result.kind === "unknown") {
        // It may have been stored: show what the server holds.
        const check = await sendMutation(`/api/deals/${dealId}`, { cache: "no-store" });
        const stored = check.kind === "ok" ? bodyField<DealRecord>(check.body, "deal") : undefined;
        setDeals((current) => current.map((deal) => (deal.id === dealId ? (stored ?? previousDeal) : deal)));
        if (stored?.status !== status) setError("error.connection");
        return;
      }
      setDeals((current) => current.map((deal) => (deal.id === dealId ? previousDeal : deal)));
      setError(result.kind === "rejected" ? mutationErrorKey(result, "dashboard.dealError") : "dashboard.dealError");
    } finally {
      setPendingDealId(null);
    }
  }

  // Marks the fields, says so above the form, and puts the keyboard on the
  // first one, so the person sees what to fix instead of a bare "could not
  // be saved" (#50).
  function showFieldErrors(errors: DealFormErrors) {
    setFieldErrors(errors);
    setError("dealForm.checkFields");
    const first = DEAL_FORM_FIELDS.find((field) => errors[field]);
    const element = first ? dealFormRef.current?.elements.namedItem(first) : null;
    if (element instanceof HTMLElement) element.focus();
  }

  function handleFormChange(next: DealFormState) {
    // Clear corrected fields and the summary only when no highlighted fields remain.
    // Calculate from the current render instead of setting error state inside a state updater.
    const changed = DEAL_FORM_FIELDS.filter((field) => fieldErrors[field] && next[field] !== form[field]);
    if (changed.length > 0) {
      const remaining = { ...fieldErrors };
      for (const field of changed) delete remaining[field];
      setFieldErrors(remaining);
      if (Object.keys(remaining).length === 0 && error === "dealForm.checkFields") {
        setError(null);
      }
    }
    setForm(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const errors = validateDealForm(form);
    if (Object.keys(errors).length > 0) {
      showFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setIsSaving(true);

    const sent = {
      ...form,
      feeIdr: Number(form.feeIdr),
      deadline: form.deadline || undefined,
      contactName: form.contactName || undefined,
      paymentTerms: form.paymentTerms || undefined,
    };
    const knownIds = new Set(deals.map((deal) => deal.id));
    // The deal an earlier, unanswered attempt may have stored.
    async function findStored() {
      const serverDeals = await readList<DealRecord>("/api/deals", "deals");
      return serverDeals ? { deal: findCreatedDeal(serverDeals, knownIds, sent) } : null;
    }
    function showSaved(deal: DealRecord) {
      dealCreateUnconfirmed.current = false;
      setDeals((current) => [deal, ...current.filter((existing) => existing.id !== deal.id)]);
      setForm(EMPTY_DEAL_FORM);
      setSuccessMessage("dashboard.dealSaved");
      setIsDialogOpen(false);
    }

    try {
      if (dealCreateUnconfirmed.current) {
        const stored = await findStored();
        if (!stored) {
          setError("dashboard.saveUnknown");
          return;
        }
        if (stored.deal) {
          showSaved(stored.deal);
          return;
        }
      }

      const result = await sendMutation("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sent),
      });
      if (result.kind === "unknown") {
        dealCreateUnconfirmed.current = true;
        const stored = await findStored();
        if (stored?.deal) showSaved(stored.deal);
        else setError("dashboard.saveUnknown");
        return;
      }
      // A definite answer: whatever an earlier attempt did is now visible
      // in the server's own reply or not stored at all.
      dealCreateUnconfirmed.current = false;
      const created = result.kind === "ok" ? bodyField<DealRecord>(result.body, "deal") : undefined;
      if (created) {
        showSaved(created);
        return;
      }
      const serverErrors = result.kind === "rejected" && result.status === 400 ? dealFormErrorsFromServer(bodyField(result.body, "fields")) : {};
      if (Object.keys(serverErrors).length > 0) showFieldErrors(serverErrors);
      else setError(result.kind === "rejected" ? mutationErrorKey(result, "dashboard.saveError") : "dashboard.saveError");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateInvoice(dealId: string) {
    setError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    // The invoice an earlier, unanswered attempt may have created.
    async function findStored() {
      const serverInvoices = await readList<InvoiceRecord>("/api/invoices", "invoices");
      return serverInvoices ? { invoice: findCreatedInvoice(serverInvoices, dealId) } : null;
    }
    function showCreated(invoice: InvoiceRecord) {
      invoiceCreateUnconfirmed.current.delete(dealId);
      setInvoices((current) => [invoice, ...current.filter((existing) => existing.id !== invoice.id)]);
      setSuccessMessage("dashboard.invoiceCreated");
    }

    try {
      if (invoiceCreateUnconfirmed.current.has(dealId)) {
        const stored = await findStored();
        if (!stored) {
          setError("dashboard.invoiceUnknown");
          return;
        }
        if (stored.invoice) {
          showCreated(stored.invoice);
          return;
        }
      }

      const result = await sendMutation("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, withholdingTaxType: "NONE" }),
      });
      if (result.kind === "unknown") {
        invoiceCreateUnconfirmed.current.add(dealId);
        const stored = await findStored();
        if (stored?.invoice) showCreated(stored.invoice);
        else setError("dashboard.invoiceUnknown");
        return;
      }
      invoiceCreateUnconfirmed.current.delete(dealId);
      const created = result.kind === "ok" ? bodyField<InvoiceRecord>(result.body, "invoice") : undefined;
      if (created) showCreated(created);
      else setError(result.kind === "rejected" ? mutationErrorKey(result, "dashboard.invoiceError") : "dashboard.invoiceError");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    // Only the readable text/controls (message banners, filter chips) stay
    // capped at 1100px -- the board itself drops that cap on desktop
    // (lg:max-w-none) so its columns get the full sidenav-adjacent width to
    // flex into instead of being squeezed into a reading-width column.
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-5 py-6 min-[640px]:px-8 min-[640px]:py-8 lg:max-w-none">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
        {successMessage ? (
          <div role="status" aria-live="polite" className="rounded-md border border-paid/30 bg-paid-tint px-4 py-3 text-[14px] font-semibold text-paid">
            {t(successMessage)}
          </div>
        ) : null}
        {error && !isDialogOpen ? <p role="alert" className="ds-small text-overdue">{t(error)}</p> : null}

        <StageFilter stageFilter={stageFilter} t={t} onChange={handleStageFilterChange} />
      </div>

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
        <DealForm formId="tambah-deal-form" formRef={dealFormRef} form={form} errors={fieldErrors} onChange={handleFormChange} onSubmit={handleSubmit} isSaving={isSaving} t={t} />
      </AddDealDialog>
    </main>
  );
}
