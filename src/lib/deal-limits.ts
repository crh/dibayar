// Limits the add-deal form mirrors (maxLength/max on its fields), so the
// browser stops a value before the server would refuse it.
export const DEAL_LIMITS = {
  brand: 120,
  contactWa: 32,
  contactName: 120,
  scope: 500,
  paymentTerms: 500,
  feeIdrMax: 10_000_000_000,
} as const;
