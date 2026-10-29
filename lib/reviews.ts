import { supabase } from './supabase';
export type ReviewKind = 'business' | 'service';
export type Review = { id: string; reviewer_id: string; rating: number; body: string | null; created_at: string; moderation_status: string; profiles?: { display_name?: string; username?: string } | null };
export type ReviewSummary = { count: number; average: number };
export const REVIEW_PAGE_SIZE = 12;
export async function loadReviewPage(kind: ReviewKind, targetId: string, page = 0) {
  const { data, error } = await supabase.from('reviews').select('id,reviewer_id,rating,body,created_at,moderation_status,profiles:reviewer_id(display_name,username)').eq(`${kind}_id`, targetId).eq('moderation_status', 'approved').order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * REVIEW_PAGE_SIZE, (page + 1) * REVIEW_PAGE_SIZE - 1);
  if (error) throw error;
  return (data || []) as unknown as Review[];
}
export async function loadReviewContext(kind: ReviewKind, targetId: string) {
  const [identity, summary, eligibility] = await Promise.all([
    supabase.auth.getUser(), supabase.rpc('hayna_review_summary', { p_kind: kind, p_target: targetId }), supabase.rpc('hayna_review_eligibility', { p_kind: kind, p_target: targetId }),
  ]);
  if (summary.error) throw summary.error;
  if (eligibility.error) throw eligibility.error;
  const userId = identity.data.user?.id || null;
  let mine: Review | null = null;
  if (userId) {
    const response = await supabase.from('reviews').select('id,reviewer_id,rating,body,created_at,moderation_status').eq(`${kind}_id`, targetId).eq('reviewer_id', userId).maybeSingle();
    if (response.error) throw response.error;
    mine = response.data as Review | null;
  }
  return { userId, mine, summary: summary.data as ReviewSummary, eligibility: eligibility.data as { can_review: boolean; reason: string } };
}
export async function saveReview(kind: ReviewKind, targetId: string, rating: number, body: string, reviewId?: string) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || body.trim().length > 1500) throw new Error('اختر تقييمًا من نجمة إلى خمس، وتعليقًا لا يزيد عن 1500 حرف.');
  const { data: identity } = await supabase.auth.getUser();
  if (!identity.user) throw new Error('سجل الدخول لإضافة تقييمك.');
  const query = reviewId
    ? supabase.from('reviews').update({ rating, body: body.trim() || null }).eq('id', reviewId).eq('reviewer_id', identity.user.id)
    : supabase.from('reviews').insert({ reviewer_id: identity.user.id, [`${kind}_id`]: targetId, rating, body: body.trim() || null });
  const { data, error } = await query.select('id').single();
  if (error || !data) throw error || new Error('لم يُحفظ التقييم، حاول مرة أخرى.');
  return data.id;
}
export async function deleteReview(reviewId: string) {
  const { data, error } = await supabase.from('reviews').delete().eq('id', reviewId).select('id').single();
  if (error || !data) throw error || new Error('لم يُحذف التقييم.');
}
export async function reportCommerce(kind: 'review' | 'event', targetId: string, reason: string) {
  const { error } = await supabase.rpc('hayna_report_commerce', { p_kind: kind, p_target: targetId, p_reason: reason });
  if (error) throw error;
}
export function reviewError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  if (e.code === '23505') return 'لديك تقييم سابق؛ يمكنك تعديله بدل إرسال تقييم جديد.';
  if (e.message?.includes('content_not_allowed')) return 'يتضمن التعليق محتوى غير مسموح. راجعه ثم حاول مجددًا.';
  if (e.code === '42501') return 'يمكن التقييم بعد تواصل متبادل مع مقدم النشاط، ولا يمكنك تقييم نشاطك.';
  return 'تعذر تنفيذ الطلب. تحقق من اتصالك وحاول مرة أخرى.';
}
