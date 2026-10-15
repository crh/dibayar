// Limits the Settings form mirrors (maxLength on its fields), so the browser
// stops a value before the server would refuse it.
export const SETTINGS_LIMITS = {
  issuerName: 120,
  issuerAddress: 500,
  issuerWhatsapp: 32,
  issuerEmail: 254,
  bankName: 120,
  bankAccountNumber: 64,
  bankAccountHolder: 120,
  templateSend: 2000,
  templateChase: 2000,
} as const;
