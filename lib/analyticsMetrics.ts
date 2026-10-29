/** Aggregated report shapes. No individual users, precise positions or private text. */
export type AnalyticsRange = 7 | 30 | 90;
export type AnalyticsSection = 'home' | 'questions' | 'requests' | 'market' | 'stories' | 'tools' | 'events' | 'explore' | 'profile' | 'other';
export type NavigationEvent = 'app_open' | 'authenticated' | 'home_view' | 'section_open' | 'app_return';
export interface FunnelPoint { step: string; count: number }
export interface RetentionPoint { cohort_week: string; week_number: number; cohort_size: number; retained_count: number; retention_rate: number; complete: boolean }
export interface RevenuePoint { date: string; confirmed_revenue: number; refunded_amount: number; fees_amount: number | null; net_revenue: number | null; source_available: boolean; sources: Record<string, number>; transaction_count: number }
export interface AnalyticsReport {
  timezone: string; generated_at: string; days: AnalyticsRange; active_definition: string;
  summary: { active_users: number; previous_active_users: number; new_accounts: number };
  dau: Array<{ date: string; dau: number }>; funnel: FunnelPoint[]; previous_funnel: FunnelPoint[];
  retention: RetentionPoint[]; revenue: RevenuePoint[]; revenue_available: boolean;
  heatmap: Array<{ city: string; district: string; count: number; active_users: number }>;
  event_totals: Record<string, number>;
}
export const FUNNEL_LABELS: Record<string, string> = {
  app_open: 'فتح التطبيق', authenticated: 'جلسة مسجّلة', location_set: 'الموقع العام جاهز',
  home_view: 'زيارة الرئيسية', section_open: 'فتح قسم', first_content_created: 'أول سؤال أو فزعة',
  content_interacted: 'التفاعل مع المحتوى', app_return: 'العودة في يوم لاحق',
};

/** Routes are bucketed without IDs or query strings. Unknown routes reveal no path. */
export function analyticsSection(path: string): AnalyticsSection {
  const route = path.split(/[?#]/,1)[0].replace(/\/+$/,'') || '/';
  if (route === '/home') return 'home';
  if (['/question','/questions'].includes(route)) return 'questions';
  if (['/request','/carpooling'].includes(route)) return 'requests';
  if (['/market','/business','/service','/new-listing','/new-service'].includes(route)) return 'market';
  if (['/story','/stories','/create-story'].includes(route)) return 'stories';
  if (route === '/tools') return 'tools';
  if (route === '/events') return 'events';
  if (['/explore','/map','/search'].includes(route)) return 'explore';
  if (['/profile','/user'].includes(route)) return 'profile';
  return 'other';
}
export function riyadhDay(now = new Date()): string {
  return new Date(now.getTime()+3*60*60*1000).toISOString().slice(0,10);
}
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return Math.round((current-previous)/previous*100);
}
export function conversion(current: number, previous: number): number | null {
  if (previous<=0 || !Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return Math.min(100,Math.max(0,Math.round(current/previous*100)));
}
export function retentionMatrix(points: RetentionPoint[]) {
  const rows = new Map<string, RetentionPoint[]>();
  for (const p of points) { const row=rows.get(p.cohort_week)||[]; row.push(p); rows.set(p.cohort_week,row); }
  return Array.from(rows,([week,values])=>({week,size:values[0]?.cohort_size||0,values:values.sort((a,b)=>a.week_number-b.week_number)})).sort((a,b)=>b.week.localeCompare(a.week));
}

export interface NavigationPayload { event_name: NavigationEvent; event_key: string; properties: { section?: AnalyticsSection }; session_id: string }
type Sender = (payload: NavigationPayload) => Promise<boolean>;
/** Bounded memory-only retry queue. Its payload cannot contain arbitrary properties. */
export function createAnalyticsQueue(send: Sender, sessionId: string) {
  const seen = new Set<string>();
  const pending = new Map<string, {actor: string; payload: NavigationPayload}>();
  let actor = ''; let flushing = false;
  return {
    identify(next: string | null) { if (actor!==next) {actor=next||'';pending.clear();seen.clear();} },
    enqueue(name: NavigationEvent, section?: AnalyticsSection, day=riyadhDay()) {
      if (!actor) return;
      const key = `${day}:${name}:${section||''}`;
      if (seen.has(key) || pending.has(key)) return;
      if (pending.size>=30) pending.delete(pending.keys().next().value!);
      pending.set(key,{actor,payload:{event_name:name,event_key:`nav:${key}`,properties:section?{section}:{},session_id:sessionId}});
    },
    async flush() {
      if(flushing || !actor) return;
      flushing=true;
      try {
        for(const [key,item] of pending) {
          if(item.actor!==actor) {pending.delete(key);continue;}
          try {
            if(!await send(item.payload)) break;
            if(item.actor===actor){seen.add(key);pending.delete(key);}
          } catch {break;}
        }
      } finally {flushing=false;}
    },
    get pendingCount() {return pending.size;},
  };
}
