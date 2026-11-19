/** Lightweight presentation helpers; order payment and transitions remain server-owned. */
export type ProductOrderAudience = 'outgoing' | 'incoming';
export type ProductOrderSummary = { id: string; status: string; created_at: string };

export function productOrderIsClosed(status: string): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'rejected';
}
export function productOrderNeedsAttention(status: string, audience: ProductOrderAudience): boolean {
  return (audience === 'incoming' && status === 'pending') || (audience === 'outgoing' && status === 'ready');
}
export function productOrderAudienceLabel(status: string, audience: ProductOrderAudience): string {
  switch (status) {
    case 'pending': return audience === 'incoming' ? 'طلب جديد' : 'بانتظار التاجر';
    case 'accepted': return 'قيد التجهيز';
    case 'ready': return audience === 'outgoing' ? 'جاهز للاستلام' : 'جاهز للتسليم';
    case 'completed': return 'تم الاستلام';
    case 'cancelled': return 'ملغي';
    case 'rejected': return 'مرفوض';
    default: return 'جاري تحديث الحالة';
  }
}
export function productOrderAudienceHint(status: string, audience: ProductOrderAudience): string {
  switch (status) {
    case 'pending': return audience === 'incoming' ? 'بانتظار موافقتك على الطلب' : 'ينتظر موافقة التاجر';
    case 'accepted': return audience === 'incoming' ? 'جهّز الطلب وحدّث حالته' : 'التاجر يجهّز طلبك';
    case 'ready': return audience === 'outgoing' ? 'نسّق موعد الاستلام مع التاجر' : 'نسّق التسليم مع العميل';
    case 'completed': return 'تم إنهاء الطلب بنجاح';
    case 'cancelled': return 'تم إلغاء الطلب';
    case 'rejected': return 'لم يوافق التاجر على الطلب';
    default: return 'اعرض التفاصيل لمتابعة آخر تحديث';
  }
}
export function productOrderStageIndex(status: string): number {
  return ['pending', 'accepted', 'ready', 'completed'].indexOf(status);
}
export function prioritizeProductOrders<T extends ProductOrderSummary>(rows: readonly T[], audience: ProductOrderAudience): T[] {
  return [...rows].sort((a,b) =>
    Number(productOrderNeedsAttention(b.status,audience)) - Number(productOrderNeedsAttention(a.status,audience))
    || Number(productOrderIsClosed(a.status)) - Number(productOrderIsClosed(b.status))
    || (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0)
  );
}
