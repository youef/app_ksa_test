// Lightweight profanity/obscenity filter for Hayna.
// Used client-side before publishing questions, products, and private messages.
// Any violation triggers an automatic account ban.

const BAD_WORDS: string[] = [
  // Arabic (common profanity / sexual / harassing)
  'كس', 'طيز', 'شرموط', 'قحبه', 'قواد', 'لعين', 'يلعن', 'يلعنك', 'ياكلب', 'ياحمار', 'ياحمير', 'ياابن', 'ياابنة', 'ياولده', 'ياولدة',
  'فاسق', 'فاجره', 'فاجر', 'زاني', 'زانية', 'لواط', 'سحاق', 'استمناء', '自慰', 'جنس', 'جنسية', 'مثير', 'إثارة', 'عارية', 'عاري', 'صدر', 'أرداف', 'فخذ',
  'تعارف', 'مغازل', 'مغازلة', 'مواعدة', 'موعد', 'حبيب', 'حبيبة', 'عشيق', 'عشيقه', 'زنا', 'لواط', 'سحاق', 'اباحي', 'إباحي', 'اباحية', 'إباحية', 'اباحي', 'اباحيات',
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'cock', 'slut', 'whore', 'cunt', 'nigger', 'faggot',
  // Variants / leetspeak
  'f*ck', 'sh*t', 'b*tch', 'a$$', 'fck', 'sht',
];

function normalize(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Arabic diacritics
    .replace(/[\u200C\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function containsProfanity(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  for (const w of BAD_WORDS) {
    const nw = normalize(w);
    if (!nw) continue;
    // word boundary-ish: check as substring but avoid tiny false positives
    if (nw.length < 3) continue;
    if (t.includes(nw)) return true;
  }
  return false;
}

export function findProfanity(text: string): string | null {
  const t = normalize(text);
  if (!t) return null;
  for (const w of BAD_WORDS) {
    const nw = normalize(w);
    if (!nw || nw.length < 3) continue;
    if (t.includes(nw)) return w;
  }
  return null;
}

export async function banAccountOnViolation(userId: string) {
  try {
    await (await import('@/lib/supabase')).supabase.from('profiles').update({ is_banned: true }).eq('id', userId);
  } catch {}
  try {
    await (await import('@/lib/supabase')).supabase.auth.signOut();
  } catch {}
}
