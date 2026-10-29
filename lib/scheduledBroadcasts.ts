export function parseSaudiDateTime(value: string): string | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  if (hour > 23 || minute > 59 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const local = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (local.getUTCFullYear() !== year || local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day) return null;
  return new Date(local.getTime() - 3 * 60 * 60 * 1000).toISOString();
}
export function formatSaudiDateTime(value: Date): string { return new Date(value.getTime() + 3 * 3600000).toISOString().slice(0, 16).replace('T', ' '); }
export function validBroadcastLink(value: string): boolean {
  if (!value.trim()) return true;
  return /^(https:\/\/[^\s]+|\/[a-zA-Z][^\s]*)$/.test(value.trim());
}
export const BROADCAST_STATUS_LABELS: Record<string, string> = { draft: 'مسودة', pending: 'مجدول', sent: 'منشور', expired: 'منتهٍ', canceled: 'ملغى', failed: 'تعذر التنفيذ' };
