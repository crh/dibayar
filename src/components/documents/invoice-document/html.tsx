import type { InvoiceDocumentModel } from "./model";
import {
  HeaderBlock,
  IssuerBlock,
  ClientBlock,
  ScopeBlock,
  TotalBlock,
  TaxBlock,
  TermsBlock,
  BankBlock,
  FooterBlock,
} from "./blocks";

// T-22: the HTML adapter for the canonical invoice document (§5.3). Renders
// the model's blocks in the fixed field order -- Header, Issuer/Client,
// Scope, Total, Tax, Terms, Bank, Footer -- inside a max-720px container.
// Issuer/Client sit in two 50% columns with a 24px gap at >=640px and stack
// below that; hairlines sit above Total and above the Bank block. This
// component owns layout only: no app chrome, no status language, no
// buttons, and no data fetching -- callers (T-23's public route, later the
// PDF adapter's own separate implementation) own everything outside it.
export function InvoiceDocumentHtml({ model, className = "" }: { model: InvoiceDocumentModel; className?: string }) {
  return (
    <article className={`mx-auto flex w-full max-w-[720px] flex-col gap-6 ${className}`}>
      <HeaderBlock header={model.header} />

      <div className="flex flex-col gap-6 sm:flex-row sm:gap-6">
        <div className="sm:w-1/2">
          <IssuerBlock issuer={model.issuer} />
        </div>
        <div className="sm:w-1/2">
          <ClientBlock client={model.client} />
        </div>
      </div>

      <ScopeBlock scope={model.scope} />

      <div className="border-t border-line pt-4">
        <TotalBlock total={model.total} />
      </div>

      <TaxBlock tax={model.tax} />

      {model.terms ? <TermsBlock terms={model.terms} /> : null}

      <div className="border-t border-line pt-4">
        <BankBlock bank={model.bank} />
      </div>

      <FooterBlock footer={model.footer} />
    </article>
  );
}
