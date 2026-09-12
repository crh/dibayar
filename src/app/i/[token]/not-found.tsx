import { PublicErrorCard } from "./public-error-card";

// Rendered for every notFound() call in this segment: an unknown token, a
// malformed token, and a rate-limited request all reach this same page
// (see page.tsx's comment) -- deliberately generic copy, since this file
// has no access to (and must not imply) which of those actually happened.
export default function PublicInvoiceNotFound() {
  return (
    <PublicErrorCard>
      <p role="alert" className="text-[17px] font-semibold text-ink">Tautan ini tidak ditemukan.</p>
      <p className="text-[14px] text-muted">Periksa kembali tautan yang Anda terima, atau hubungi pengirim.</p>
    </PublicErrorCard>
  );
}
