/** A contact number is optional and independent of the Supabase Auth phone. */
export function normalizeContactPhone(input: string): string | null {
  let phone = input.trim()
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\s()\-\u200e\u200f\u061c]/g, '');
  if (!phone) return '';
  if (/^05\d{8}$/.test(phone)) phone = '+966' + phone.slice(1);
  else if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  else if (/^9665\d{8}$/.test(phone)) phone = '+' + phone;
  if (phone.startsWith('+966') && !/^\+9665\d{8}$/.test(phone)) return null;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export const CONTACT_PHONE_ERROR = 'أدخل جوالًا سعوديًا مثل 05xxxxxxxx، أو رقمًا دوليًا يبدأ بـ + ورمز الدولة.';
