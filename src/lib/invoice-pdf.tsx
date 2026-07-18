import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { DealRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";

// Narrowed to exactly the fields this component renders, so callers (including the
// public token-scoped PDF route) can supply a minimal safe projection instead of a
// full owner-scoped record.
type InvoicePdfInvoice = Pick<InvoiceRecord, "number" | "subtotalIdr" | "withholdingTaxType" | "status" | "dueDate">;
type InvoicePdfDeal = Pick<DealRecord, "brand" | "scope">;

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: "Helvetica", color: "#171717", fontSize: 10 },
  header: { marginBottom: 28, borderBottomWidth: 1, borderBottomColor: "#e5e5e5", paddingBottom: 16 },
  brand: { fontSize: 21, fontFamily: "Helvetica-Bold", letterSpacing: 1.5 },
  title: { marginTop: 8, color: "#6b7280", fontSize: 11 },
  invoiceNumber: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  muted: { color: "#6b7280" },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e5e5e5", marginTop: 16 },
  total: { marginTop: 16, flexDirection: "row", justifyContent: "space-between", fontFamily: "Helvetica-Bold", fontSize: 14 },
  footer: { marginTop: 40, color: "#6b7280", fontSize: 9 },
});

const idr = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

function formatIdr(value: number) {
  return `Rp${idr.format(value)}`;
}

function formatDate(value: Date | null) {
  if (!value) return "Belum ditentukan";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

export function InvoicePdf({ invoice, deal }: { invoice: InvoicePdfInvoice; deal: InvoicePdfDeal | null }) {
  return (
    <Document title={invoice.number} author="Dibayar">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>DIBAYAR</Text>
          <Text style={styles.title}>Invoice kolaborasi brand</Text>
        </View>

        <Text style={styles.invoiceNumber}>{invoice.number}</Text>
        <Text style={styles.muted}>Status: {invoice.status}</Text>

        <View style={styles.row}>
          <View>
            <Text style={styles.muted}>Ditagihkan kepada</Text>
            <Text>{deal?.brand ?? "Brand"}</Text>
          </View>
          <View>
            <Text style={styles.muted}>Jatuh tempo</Text>
            <Text>{formatDate(invoice.dueDate)}</Text>
          </View>
        </View>

        <View style={styles.divider} />
        <View style={styles.row}>
          <View>
            <Text>Jasa kolaborasi</Text>
            <Text style={styles.muted}>{deal?.scope ?? "Kolaborasi brand"}</Text>
          </View>
          <Text>{formatIdr(invoice.subtotalIdr)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.muted}>Pajak potong</Text>
          <Text>{invoice.withholdingTaxType === "NONE" ? "Tidak ada" : invoice.withholdingTaxType.replace("PPH", "PPh ")}</Text>
        </View>
        <View style={styles.total}>
          <Text>Total invoice</Text>
          <Text>{formatIdr(invoice.subtotalIdr)}</Text>
        </View>

        <Text style={styles.footer}>Dokumen ini dibuat oleh Dibayar. Simpan sebagai bukti administrasi kolaborasi.</Text>
      </Page>
    </Document>
  );
}
