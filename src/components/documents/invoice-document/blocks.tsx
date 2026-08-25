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
      <p className="mt-1 text-[15px] font-semibold text-ink">{issuer.name}</p>
      {issuer.address ? <p className="mt-0.5 text-[14px] text-ink">{issuer.address}</p> : null}
      {issuer.whatsapp ? <p className="mt-0.5 text-[14px] text-ink">{issuer.whatsapp}</p> : null}
      {issuer.email ? <p className="mt-0.5 text-[14px] text-ink">{issuer.email}</p> : null}
    </div>
  );
}

export function ClientBlock({ client }: { client: InvoiceDocumentModel["client"] }) {
  return (
    <div>
      <h2 className="text-[13px] font-bold text-muted">Ditagihkan kepada</h2>
      <p className="mt-1 text-[15px] font-semibold text-ink">{client.brand}</p>
      {client.contactName ? <p className="mt-0.5 text-[14px] text-ink">{client.contactName}</p> : null}
    </div>
  );
}

export function ScopeBlock({ scope }: { scope: InvoiceDocumentModel["scope"] }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[12px] font-semibold text-muted">Deskripsi</p>
        <p className="mt-0.5 text-[15px] text-ink">{scope.description}</p>
      </div>
      <div className="text-right">
        <p className="text-[12px] font-semibold text-muted">Jumlah</p>
        <p className="mt-0.5 font-serif text-[15px] tabular-nums text-ink">{scope.amountLabel}</p>
      </div>
    </div>
  );
}

export function TotalBlock({ total }: { total: InvoiceDocumentModel["total"] }) {
  return (
    <div className="flex items-baseline justify-between">
      <p className="text-[15px] font-bold text-ink">Total</p>
      <p className="font-serif text-[24px] font-semibold tabular-nums text-ink">{total.amountLabel}</p>
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

export function TermsBlock({ terms }: { terms: NonNullable<InvoiceDocumentModel["terms"]> }) {
  return (
    <div>
      <h2 className="text-[13px] font-bold text-muted">Syarat pembayaran</h2>
      <p className="mt-1 text-[14px] text-ink">{terms.text}</p>
      {terms.dueDateLabel ? (
        <p className="mt-1 text-[14px] text-ink">
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
