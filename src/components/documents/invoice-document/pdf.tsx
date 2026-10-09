import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { InvoiceDocumentModel } from "./model";

// T-24: the react-pdf adapter for the canonical invoice document (§5.3).
// Renders the exact same model, in the exact same field order, as the HTML
// adapter (html.tsx) -- same fields, same values, same optional-field
// behavior -- so a diff between /i/:token and page 1 of this PDF shows no
// divergence. Takes only `model`: no language prop exists, so there is no
// way for a future change to thread the creator's UI language into a
// recipient-facing PDF.

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: "Helvetica", color: "#171717", fontSize: 10 },
  overline: { fontSize: 11, fontFamily: "Helvetica-Bold", letterSpacing: 1.5 },
  label: { color: "#6b7280", fontSize: 9 },
  value: { fontSize: 11, marginTop: 2 },
  bold: { fontFamily: "Helvetica-Bold" },
  section: { marginTop: 16 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  columns: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  column: { width: "48%" },
  hairline: { borderTopWidth: 1, borderTopColor: "#e5e5e5", marginTop: 16, paddingTop: 16 },
  total: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  amount: { fontFamily: "Helvetica-Bold" },
  alert: { color: "#b91c1c", fontFamily: "Helvetica-Bold", fontSize: 9, marginTop: 4 },
  footer: { marginTop: 32, color: "#6b7280", fontSize: 8 },
});

export function InvoiceDocumentPdf({ model }: { model: InvoiceDocumentModel }) {
  return (
    <Document title={model.header.number} author="Dibayar">
      <Page size="A4" style={styles.page}>
        <Text style={styles.overline}>{model.header.title}</Text>
        <Text style={[styles.value, { marginTop: 8 }]}>
          <Text style={styles.label}>Nomor invoice: </Text>
          {model.header.number}
        </Text>
        <Text style={styles.value}>
          <Text style={styles.label}>Tanggal terbit: </Text>
          {model.header.issueDateLabel}
        </Text>

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={[styles.label, styles.bold]}>Dari</Text>
            <Text style={[styles.value, styles.bold]}>{model.issuer.name}</Text>
            {model.issuer.address ? <Text style={styles.value}>{model.issuer.address}</Text> : null}
            {model.issuer.whatsapp ? <Text style={styles.value}>{model.issuer.whatsapp}</Text> : null}
            {model.issuer.email ? <Text style={styles.value}>{model.issuer.email}</Text> : null}
          </View>
          <View style={styles.column}>
            <Text style={[styles.label, styles.bold]}>Ditagihkan kepada</Text>
            <Text style={[styles.value, styles.bold]}>{model.client.brand}</Text>
            {model.client.contactName ? <Text style={styles.value}>{model.client.contactName}</Text> : null}
          </View>
        </View>

        <View style={[styles.row, styles.section]}>
          <View>
            <Text style={styles.label}>Deskripsi</Text>
            <Text style={styles.value}>{model.scope.description}</Text>
          </View>
          <View>
            <Text style={styles.label}>Jumlah</Text>
            <Text style={[styles.value, styles.amount]}>{model.scope.amountLabel}</Text>
          </View>
        </View>

        <View style={[styles.row, styles.hairline]}>
          <Text style={styles.total}>Total</Text>
          <Text style={styles.total}>{model.total.amountLabel}</Text>
        </View>

        <View style={[styles.row, styles.section]}>
          <Text style={styles.label}>Pajak potong</Text>
          <Text style={[styles.value, styles.bold, { marginTop: 0 }]}>{model.tax.label}</Text>
        </View>

        {model.terms ? (
          <View style={styles.section}>
            {model.terms.text ? <Text style={[styles.label, styles.bold]}>Syarat pembayaran</Text> : null}
            {model.terms.text ? <Text style={styles.value}>{model.terms.text}</Text> : null}
            {model.terms.dueDateLabel ? (
              <Text style={styles.value}>
                <Text style={styles.label}>Jatuh tempo: </Text>
                {model.terms.dueDateLabel}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.hairline}>
          <Text style={[styles.label, styles.bold]}>Pembayaran ke</Text>
          <Text style={styles.value}>
            <Text style={styles.label}>Bank: </Text>
            {model.bank.bankName}
          </Text>
          <Text style={styles.value}>
            <Text style={styles.label}>Nomor rekening: </Text>
            {model.bank.accountNumber}
          </Text>
          <Text style={styles.value}>
            <Text style={styles.label}>Atas nama: </Text>
            {model.bank.accountHolder}
          </Text>
          {model.bank.incomplete ? <Text style={styles.alert}>Detail rekening belum lengkap.</Text> : null}
        </View>

        <Text style={styles.footer}>{model.footer.text}</Text>
      </Page>
    </Document>
  );
}
