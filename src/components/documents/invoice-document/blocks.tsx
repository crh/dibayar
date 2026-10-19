import type { InvoiceDocumentModel } from "./model";

// T-22: pure presentational blocks for the HTML document adapter (html.tsx).
// Each block owns exactly the fixed Indonesian labels from
// dibayar-implementation-spec.md §5.3 ([ID-ONLY], never translated) and
// renders nothing else -- no app chrome, no status language, no buttons.
// Money uses `font-serif`; everything else uses the document's sans body font.

export function HeaderBlock({ header }: { header: InvoiceDocumentModel["header"] }) {
  return (
    <div>
      <p className="text-[13px] font-bold tracking-[0.08em] text-muted">{header.title}</p>
      <p className="mt-2 text-[15px] text-ink">
        <span className="text-muted">Nomor invoice: </span>
        {header.number}
      </p>
      <p className="mt-1 text-[15px] text-ink">
        <span className="text-muted">Tanggal terbit: </span>
        {header.issueDateLabel}
      </p>
    </div>
  );
}

export function IssuerBlock({ issuer }: { issuer: InvoiceDocumentModel["issuer"] }) {
  return (
    <div>
      <h2 className="text-[13px] font-bold text-muted">Dari</h2>
      {/* break-words: an owner-entered issuer/business name with no
          spaces (a plausible real value -- see user-settings-validation.ts's
          120-char max) otherwise overflows this block past the viewport at
          390px, since block elements don't break unbreakable words by
          default and this is a formal document a recipient reads in full,
          not a space-constrained card that could truncate instead.
          Confirmed as a genuine horizontal-scroll bug on the public
          recipient-facing /i/[token] route, this component's only web
          consumer, before this fix. */}
      <p className="mt-1 break-words text-[15px] font-semibold text-ink">{issuer.name}</p>
      {issuer.address ? <p className="mt-0.5 text-[14px] text-ink">{issuer.address}</p> : null}
      {issuer.whatsapp ? <p className="mt-0.5 text-[14px] text-ink">{issuer.whatsapp}</p> : null}
      {issuer.email ? <p className="mt-0.5 break-words text-[14px] text-ink">{issuer.email}</p> : null}
    </div>
  );
}

export function ClientBlock({ client }: { client: InvoiceDocumentModel["client"] }) {
  return (
    <div>
      <h2 className="text-[13px] font-bold text-muted">Ditagihkan kepada</h2>
      {/* Same reasoning as IssuerBlock above -- client.brand is the same
          user-entered field (deal-validation.ts's 120-char brand). */}
      <p className="mt-1 break-words text-[15px] font-semibold text-ink">{client.brand}</p>
      {client.contactName ? <p className="mt-0.5 text-[14px] text-ink">{client.contactName}</p> : null}
    </div>
  );
}

export function ScopeBlock({ scope }: { scope: InvoiceDocumentModel["scope"] }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-muted">Deskripsi</p>
        <p className="mt-0.5 break-words text-[15px] text-ink">{scope.description}</p>
      </div>
      <div className="text-right">
        <p className="text-[12px] font-semibold text-muted">Jumlah</p>
        <p data-ux-money="list" className="mt-0.5 font-serif text-[17px] tabular-nums text-ink">{scope.amountLabel}</p>
      </div>
    </div>
  );
}

export function TotalBlock({ total }: { total: InvoiceDocumentModel["total"] }) {
  return (
    <div className="flex items-baseline justify-between">
      <p className="text-[15px] font-bold text-ink">Total</p>
      <p data-ux-money="display" className="font-serif text-[28px] font-semibold tabular-nums text-ink">{total.amountLabel}</p>
    </div>
  );
}

export function TaxBlock({ tax }: { tax: InvoiceDocumentModel["tax"] }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[13px] text-muted">Pajak potong</p>
      <p className="text-[14px] font-semibold text-ink">{tax.label}</p>
    </div>
  );
}

// The "Syarat pembayaran" heading belongs to the terms text, so a document
// with a due date but no payment terms shows the due-date line alone (no
// empty heading or value).
export function TermsBlock({ terms }: { terms: NonNullable<InvoiceDocumentModel["terms"]> }) {
  return (
    <div>
      {terms.text ? (
        <>
          <h2 className="text-[13px] font-bold text-muted">Syarat pembayaran</h2>
          <p className="mt-1 break-words text-[14px] text-ink">{terms.text}</p>
        </>
      ) : null}
      {terms.dueDateLabel ? (
        <p className={`${terms.text ? "mt-1 " : ""}text-[14px] text-ink`}>
          <span className="text-muted">Jatuh tempo: </span>
          {terms.dueDateLabel}
        </p>
      ) : null}
    </div>
  );
}

export function BankBlock({ bank }: { bank: InvoiceDocumentModel["bank"] }) {
  return (
    <div>
      <h2 className="text-[13px] font-bold text-muted">Pembayaran ke</h2>
      <p className="mt-1 text-[14px] text-ink">
        <span className="text-muted">Bank: </span>
        {bank.bankName}
      </p>
      <p className="mt-0.5 text-[14px] text-ink">
        <span className="text-muted">Nomor rekening: </span>
        {bank.accountNumber}
      </p>
      <p className="mt-0.5 text-[14px] text-ink">
        <span className="text-muted">Atas nama: </span>
        {bank.accountHolder}
      </p>
      {bank.incomplete ? (
        <p role="alert" className="mt-2 text-[13px] font-semibold text-overdue">
          Detail rekening belum lengkap.
        </p>
      ) : null}
    </div>
  );
}

export function FooterBlock({ footer }: { footer: InvoiceDocumentModel["footer"] }) {
  return <p className="text-[12px] text-muted">{footer.text}</p>;
}
