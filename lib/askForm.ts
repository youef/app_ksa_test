export function normalizeAskNumber(value: string): string {
  return value.trim()
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/٬/g, '').replace(/[٫,]/g, '.');
}

export function parseAskReward(value: string): number | null {
  if (!value.trim()) return null;
  const normalized = normalizeAskNumber(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return NaN;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : NaN;
}

export function includesPrivateSchoolDetails(text: string): boolean {
  const normalized = text.replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0));
  return /(?:\+?966|05)\s*[- ]?\d[\d\s-]{7,}|(?:\d{1,2}[:٫]\d{2})|(?:منزل|بيتنا|عنوان المنزل|رقم البيت|رقم العمارة|رقم الشارع|رقم المبنى)/i.test(normalized);
}
