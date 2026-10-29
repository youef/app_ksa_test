export const MAX_REQUEST_TAGS = 5;
export function normalizeRequestTag(value: string): string {
  return value.toLowerCase().replace(/[\u064b-\u065f\u0670\u0640\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[\s#]+/g, ' ').trim();
}
export function normalizeRequestTags(tags: string[]): string[] {
  return [...new Set(tags.map(normalizeRequestTag).filter(tag => tag.length >= 2 && tag.length <= 30 && /^[\p{L}\p{N} _-]+$/u.test(tag)))].slice(0, MAX_REQUEST_TAGS);
}
export function suggestRequestTags(text: string): string[] {
  const normalized = normalizeRequestTag(text);
  const rules: [RegExp, string[]][] = [
    [/بطاري|سيار|بنشر|كفر/, ['سيارات', 'بطاريه', 'صيانة']],
    [/نقل|دولاب|اثاث|كنب/, ['نقل اغراض', 'اثاث']],
    [/ماء|سباك|تكييف|كهرب|صيانه/, ['صيانة', 'خدمات الحي']],
    [/سلم|دريل|اداه|عده/, ['ادوات', 'اعاره']],
    [/مدرس|توصيل|طلاب/, ['توصيل مدارس', 'توصيل']],
  ];
  return normalizeRequestTags([...rules.filter(([pattern]) => pattern.test(normalized)).flatMap(([, tags]) => tags), 'مساعده', 'فزعه الحي']);
}

export function tagsFromRows(rows: { tag: string }[] | null | undefined): string[] {
  return normalizeRequestTags((rows || []).map(row => row.tag));
}
