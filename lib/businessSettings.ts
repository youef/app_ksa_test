import { businessPhone, businessWebsite } from './directoryPresentation';
export type BusinessDraft = { name: string; description: string; address: string; phone: string; whatsapp: string; website: string };
export function businessSettingsPayload(draft: BusinessDraft) {
  if (draft.name.trim().length < 3 || draft.name.trim().length > 100) throw new Error('اسم المنشأة من ٣ إلى ١٠٠ حرف.');
  if (draft.description.trim().length > 2000 || draft.address.trim().length > 250) throw new Error('النبذة حتى ٢٠٠٠ حرف، والعنوان حتى ٢٥٠ حرفًا.');
  const phone = businessPhone(draft.phone), whatsapp = businessPhone(draft.whatsapp), website = businessWebsite(draft.website);
  if (draft.phone.trim() && !phone || draft.whatsapp.trim() && !whatsapp) throw new Error('راجع رقم الاتصال والواتساب مع رمز الدولة.');
  if (draft.website.trim() && !website) throw new Error('أدخل رابط موقع HTTPS صالحًا.');
  return { name: draft.name.trim(), description: draft.description.trim() || null, address: draft.address.trim() || null, phone: phone ? '+' + phone : null, whatsapp: whatsapp ? '+' + whatsapp : null, website };
}
