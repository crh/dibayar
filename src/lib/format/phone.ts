// Groups digits as [firstSize] then repeated [chunkSize] chunks, with the
// final chunk shortened rather than dropped when it doesn't divide evenly.
function groupFromLeft(value: string, firstSize: number, chunkSize: number): string {
  if (value.length <= firstSize) return value;
  const groups = [value.slice(0, firstSize)];
  for (let i = firstSize; i < value.length; i += chunkSize) {
    groups.push(value.slice(i, i + chunkSize));
  }
  return groups.join("-");
}

// Pure display formatting for an already-normalized digit string (no leading
// "+", no separators — see normalizeWhatsAppNumber in src/lib/whatsapp.ts).
// Does not validate, normalize, or otherwise touch WhatsApp link behavior;
// that stays owned by T-18.
export function formatPhone(digits: string): string {
  const clean = digits.replace(/\D/g, "");
  if (!clean) return "";

  if (clean.startsWith("62")) {
    const national = clean.slice(2);
    return `+62 ${groupFromLeft(national, 3, 4)}`;
  }

  return `+${groupFromLeft(clean, 3, 3)}`;
}
