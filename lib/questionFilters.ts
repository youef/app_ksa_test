import { isEmergencyQuestion, isToolQuestion } from './homeUtils';
export type QuestionFilters = { kind: string; status: string; period: string; author: string };
export const DEFAULT_QUESTION_FILTERS: QuestionFilters = { kind: 'الكل', status: 'الكل', period: 'كل الأوقات', author: 'الجميع' };
export function filterQuestions(items: any[], filters: QuestionFilters, userId: string | null, sort: string, district: string, now = Date.now()) {
  return items.filter(q => {
    const emergency = isEmergencyQuestion(q), tool = isToolQuestion(q);
    const text = `${q.category || ''} ${q.title || ''}`;
    if (filters.author === 'منشوراتي' && (!userId || q.author_id !== userId)) return false;
    if (filters.kind === 'الطوارئ' && !emergency) return false;
    if (filters.kind === 'إعارة أدوات' && !tool) return false;
    if (filters.kind === 'تبرعات' && q.item_type !== 'donate' && !/تبرع|تبرّع|donation/.test(text)) return false;
    if (filters.kind === 'طلبات المساعدة' && !/فزع|مساعد|help/.test(text)) return false;
    if (filters.kind === 'خدمات الحي' && !/خدم|صيان|تنظيف|توصيل|سباك|كهرب|نجار/.test(text)) return false;
    if (filters.kind === 'استفسارات' && (emergency || tool || q.item_type === 'donate' || /تبرع|تبرّع|فزع|مساعد/.test(text))) return false;
    const answered = Number(q.answers_count ?? q.answers?.length ?? 0) > 0;
    const completed = Boolean(q.best_answer_id || q.is_resolved || q.is_closed || ['completed','resolved','closed','done','found','helped','not_needed'].includes(String(q.resolution_status || q.status || '')));
    if (filters.status === 'بانتظار المساعدة' && (completed || answered)) return false;
    if (filters.status === 'تم الرد' && (!answered || completed)) return false;
    if (filters.status === 'مكتمل' && !completed) return false;
    const days = filters.period === 'اليوم' ? 1 : filters.period === 'هذا الأسبوع' ? 7 : filters.period === 'هذا الشهر' ? 30 : 0;
    const age = now - Date.parse(q.created_at);
    if (days && (!Number.isFinite(age) || age < 0 || age > days * 86400000)) return false;
    return true;
  }).sort((a,b) => {
    const featured = Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured));
    if (featured) return featured;
    if (sort === 'engaged') {
      const score = (q: any) => Number(q.answers_count ?? q.answers?.length ?? 0) * 3 + Number(q.likes_count ?? q.likes ?? 0) * 2 + Number(q.views_count ?? q.views ?? 0);
      const delta = score(b) - score(a); if (delta) return delta;
    }
    if (sort === 'nearby') {
      const delta = Number(b.district === district) - Number(a.district === district); if (delta) return delta;
    }
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });
}
