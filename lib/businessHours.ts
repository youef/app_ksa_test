import { supabase } from './supabase';

export const SAUDI_TIME_ZONE = 'Asia/Riyadh';
export const WEEK_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export type BusinessPeriod = { day_of_week: number; period_index: number; opens_at: string | null; closes_at: string | null; is_closed: boolean; temporary_closed_until?: string | null };
export type BusinessStatus = { is_open: boolean; has_schedule: boolean; next_opens_at: string | null; temporary_closed_until: string | null; timezone: string };

export function isValidTime(value: string): boolean { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
export function timeMinutes(value: string): number { const [h, m] = value.slice(0, 5).split(':').map(Number); return h * 60 + m; }
export function validatePeriods(periods: BusinessPeriod[]): string | null {
  const keys = new Set<string>();
  const intervals: { start: number; end: number; day: number }[] = [];
  for (const p of periods) {
    if (!Number.isInteger(p.day_of_week) || p.day_of_week < 0 || p.day_of_week > 6 || !Number.isInteger(p.period_index) || p.period_index < 0 || p.period_index > 5) return 'تحقق من أيام وفترات العمل.';
    const key = `${p.day_of_week}:${p.period_index}`;
    if (keys.has(key)) return 'توجد فترة مكررة.';
    keys.add(key);
    if (p.is_closed) {
      if (periods.some(other => other !== p && other.day_of_week === p.day_of_week)) return 'اليوم المغلق لا يحتوي على فترات عمل.';
      continue;
    }
    if (!p.opens_at || !p.closes_at || !isValidTime(p.opens_at.slice(0, 5)) || !isValidTime(p.closes_at.slice(0, 5))) return 'اكتب الأوقات بصيغة 09:00 و22:30.';
    const start = p.day_of_week * 1440 + timeMinutes(p.opens_at);
    let end = p.day_of_week * 1440 + timeMinutes(p.closes_at);
    if (end === start) return 'وقت الإغلاق يجب أن يختلف عن الفتح.';
    if (end < start) end += 1440;
    for (const old of intervals) {
      if ([0, -10080, 10080].some(offset => start < old.end + offset && end > old.start + offset)) return 'بعض فترات العمل متداخلة، بما فيها الفترات بعد منتصف الليل.';
    }
    intervals.push({ start, end, day: p.day_of_week });
  }
  return null;
}

/** Inputs have an explicit Saudi offset; device/browser timezone never changes the saved time. */
export function saudiDateTimeToISO(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+03:00`);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: SAUDI_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (key: string) => parts.find(p => p.type === key)?.value;
  if (`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}` !== value) return null;
  return date.toISOString();
}
export function formatSaudiDate(value: string): string { return new Intl.DateTimeFormat('ar-SA', { timeZone: SAUDI_TIME_ZONE, weekday: 'long', hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' }).format(new Date(value)); }
export async function loadBusinessHours(businessId: string) {
  const [rows, status] = await Promise.all([
    supabase.from('business_hours').select('day_of_week,period_index,opens_at,closes_at,is_closed,temporary_closed_until').eq('business_id', businessId).order('day_of_week').order('period_index'),
    supabase.rpc('hayna_business_status', { p_business_id: businessId }),
  ]);
  if (rows.error) throw rows.error;
  if (status.error) throw status.error;
  return { periods: (rows.data || []) as BusinessPeriod[], status: status.data as BusinessStatus | null };
}
export async function saveBusinessHours(businessId: string, periods: BusinessPeriod[], closedUntil: string | null) {
  const problem = validatePeriods(periods);
  if (problem) throw new Error(problem);
  const { error } = await supabase.rpc('hayna_save_business_hours', { p_business_id: businessId, p_periods: periods, p_closed_until: closedUntil });
  if (error) throw error;
}
