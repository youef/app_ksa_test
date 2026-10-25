// Lightweight profanity/obscenity filter for Hayna.
// Used client-side before publishing questions, products, and private messages.
// Any violation triggers an automatic account ban.

// Keep client hints conservative; Supabase is the authoritative moderation source.
const BAD_WORDS: string[] = [
  'شرموط', 'شرموطة', 'قحبة', 'قحبه', 'قواد', 'متناك', 'منيوك', 'ديوث',
  'fuck', 'fucking', 'motherfucker', 'bitch', 'asshole', 'cunt', 'whore', 'slut',
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
  return findProfanity(text) !== null;
}

export function findProfanity(text: string): string | null {
  const normalized = normalize(text)
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}_]+/gu, ' ');
  const padded = ` ${normalized} `;
  for (const word of getCachedBannedWords()) {
    const candidate = normalize(word)
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/[^\p{L}\p{N}_]+/gu, ' ').trim();
    if (candidate.length >= 3 && padded.includes(` ${candidate} `)) return word;
  }
  return null;
}

let cachedWords: string[] | null = null;

export async function loadBannedWords(): Promise<string[]> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase.from('banned_words').select('word').eq('enabled', true);
    if (error) throw error;
    const dbWords = (data || []).map((r: any) => String(r.word));
    cachedWords = Array.from(new Set(dbWords));
  } catch {
    cachedWords = [...BAD_WORDS];
  }
  return cachedWords;
}

export function getCachedBannedWords(): string[] {
  return cachedWords ?? BAD_WORDS;
}

export async function banAccountOnViolation(userId: string, contentType?: string, content?: string, _detectedWord?: string | null) {
  const { supabase } = await import('@/lib/supabase');
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || auth.user.id !== userId || !contentType || !content) return;
  // Only the database can verify a violation and change protected profile fields.
  const { data, error } = await supabase.rpc('hayna_report_own_prohibited_content', {
    p_content_type: contentType,
    p_content: content.slice(0, 2000),
  });
  if (error) {
    console.warn('Moderation verification failed:', error.message);
    return;
  }
  if (data === true) await supabase.auth.signOut();
}
