export type DocumentField = {
  key: string;
  label: string;
  value: string;
};

export type DocumentParityResult = {
  equal: boolean;
  missingFromHtml: DocumentField[];
  missingFromPdf: DocumentField[];
  mismatches: Array<{ key: string; html: DocumentField; pdf: DocumentField }>;
};

export function compareDocumentFields(html: DocumentField[], pdf: DocumentField[]): DocumentParityResult {
  const htmlMap = new Map(html.map((field) => [field.key, field]));
  const pdfMap = new Map(pdf.map((field) => [field.key, field]));
  const missingFromHtml = pdf.filter((field) => !htmlMap.has(field.key));
  const missingFromPdf = html.filter((field) => !pdfMap.has(field.key));
  const mismatches: DocumentParityResult["mismatches"] = [];
  for (const [key, htmlField] of htmlMap) {
    const pdfField = pdfMap.get(key);
    if (!pdfField) continue;
    if (htmlField.label !== pdfField.label || htmlField.value !== pdfField.value) {
      mismatches.push({ key, html: htmlField, pdf: pdfField });
    }
  }
  const sameOrder = html.map((field) => field.key).join("\0") === pdf.map((field) => field.key).join("\0");
  return {
    equal: sameOrder && missingFromHtml.length === 0 && missingFromPdf.length === 0 && mismatches.length === 0,
    missingFromHtml,
    missingFromPdf,
    mismatches,
  };
}
