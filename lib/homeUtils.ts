export type HomeTab = 'all' | 'emergency' | 'tools' | 'questions' | 'requests' | 'mine';

export type Profile = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean | null;
  is_geoverified?: boolean | null;
  region?: string | null;
  city?: string | null;
  district?: string | null;
  [key: string]: any;
};

export type Answer = {
  id: string;
  question_id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles?: Profile | null;
  [key: string]: any;
};

export type Question = {
  id: string;
  author_id: string;
  title: string;
  body?: string | null;
  city?: string | null;
  district?: string | null;
  category?: string | null;
  is_emergency?: boolean | null;
  urgency_level?: string | null;
  is_tool_sharing?: boolean | null;
  item_type?: string | null;
  created_at: string;
  profiles?: Profile | null;
  answers?: Answer[];
  answers_count?: number;
  [key: string]: any;
};

export type HelpRequest = {
  id: string;
  requester_id: string;
  title: string;
  description?: string | null;
  city?: string | null;
  district?: string | null;
  category?: string | null;
  status?: string;
  created_at: string;
  profiles?: Profile | null;
  [key: string]: any;
};

export type Story = {
  id: string;
  author_id: string;
  type?: string | null;
  content?: string | null;
  bg_color?: string | null;
  created_at: string;
  expires_at: string;
  profiles?: Profile | null;
  [key: string]: any;
};

export type FeedItem =
  | { type: 'question'; data: Question }
  | { type: 'request'; data: HelpRequest };

export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLocaleLowerCase('ar')
    .trim()
    .replace(/\s+/g, ' ');
}

export function getGreeting(date = new Date()): string {
  const h = date.getHours();
  if (h >= 4 && h < 12) return 'صباح الخير';
  if (h >= 12 && h < 17) return 'طاب يومك';
  if (h >= 17 && h < 21) return 'مساء الخير';
  return 'مساء النور';
}

const EMERGENCY_WORDS = ['مفقود', 'طارئ', 'حادث', 'حريق', 'اسعاف', 'إسعاف'];
const TOOL_WORDS = ['إعارة', 'اعارة', 'دريل', 'سلم', 'عدة', 'معدات'];

const hasWord = (text: unknown, words: string[]) => {
  const t = normalizeSearchText(text);
  return words.some(w => t.includes(normalizeSearchText(w)));
};

export function isEmergencyQuestion(q: Question): boolean {
  return !!q.is_emergency || q.urgency_level === 'emergency' || hasWord(q.title, EMERGENCY_WORDS);
}

export function isToolQuestion(q: Question): boolean {
  return !!q.is_tool_sharing || q.item_type === 'tool_sharing' || q.item_type === 'borrow' || hasWord(q.title, TOOL_WORDS);
}

/** Removes only true duplicates: same id, or same author posting the same title twice. */
export function dedupe<T extends { id: string; title?: string | null }>(
  rows: T[],
  authorKey: 'author_id' | 'requester_id',
): T[] {
  const ids = new Set<string>();
  const sig = new Set<string>();
  return rows.filter((row: any) => {
    if (ids.has(row.id)) return false;
    const s = `${row[authorKey] ?? ''}|${normalizeSearchText(row.title)}`;
    if (sig.has(s)) return false;
    ids.add(row.id);
    sig.add(s);
    return true;
  });
}

export function toFeed(questions: Question[], requests: HelpRequest[]): FeedItem[] {
  return [
    ...questions.map(data => ({ type: 'question' as const, data })),
    ...requests.map(data => ({ type: 'request' as const, data })),
  ].sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime());
}
