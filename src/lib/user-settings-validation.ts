import { z } from "zod";

// Exact default template text from dibayar-implementation-spec.md §5.2
// (`whatsapp.send.default` / `whatsapp.chase.default`). A saved template equal
// to `undefined` (see emptyToUndefined below) means "use the default" — the
// default text itself is never written to the row, so a future spec change to
// the default reaches users who never customized their template.
export const DEFAULT_TEMPLATE_SEND =
  "Halo {brand}, berikut invoice {nomor_invoice} sebesar {jumlah}.\n" +
  "Jatuh tempo {jatuh_tempo}.\n" +
  "Detail dan unduh PDF: {tautan}\n" +
  "Terima kasih!";

export const DEFAULT_TEMPLATE_CHASE =
  "Halo {brand}, izin mengingatkan invoice {nomor_invoice} sebesar {jumlah} yang jatuh tempo {jatuh_tempo}.\n" +
  "Mohon dibantu prosesnya ya. Detail: {tautan}\n" +
  "Terima kasih!";

// An empty (or whitespace-only) optional field means "not set" / "reset to
// default", not a stored empty string, so it normalizes to `undefined` before
// the rest of the schema runs.
function emptyToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function optionalText(max: number, message: string) {
  return z.preprocess(emptyToUndefined, z.string().trim().max(max, message).optional());
}

export const userSettingsInputSchema = z.object({
  issuerName: z.string().trim().min(1, "Nama penerbit wajib diisi").max(120, "Nama penerbit terlalu panjang"),
  issuerAddress: optionalText(500, "Alamat terlalu panjang"),
  issuerWhatsapp: optionalText(32, "Nomor WhatsApp tidak valid"),
  issuerEmail: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(254, "Email terlalu panjang").email("Email tidak valid").optional(),
  ),
  bankName: z.string().trim().min(1, "Nama bank wajib diisi").max(120, "Nama bank terlalu panjang"),
  bankAccountNumber: z
    .string()
    .trim()
    .min(1, "Nomor rekening wajib diisi")
    .max(64, "Nomor rekening terlalu panjang"),
  bankAccountHolder: z
    .string()
    .trim()
    .min(1, "Nama pemilik rekening wajib diisi")
    .max(120, "Nama pemilik rekening terlalu panjang"),
  templateSend: optionalText(2000, "Template pesan terlalu panjang"),
  templateChase: optionalText(2000, "Template pesan terlalu panjang"),
});

export type UserSettingsInput = z.infer<typeof userSettingsInputSchema>;
