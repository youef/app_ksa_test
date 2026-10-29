export type BorrowStatus = 'pending' | 'accepted' | 'borrowed' | 'return_requested' | 'returned' | 'rejected' | 'cancelled' | 'disputed';
export const BORROW_STATUS_LABELS: Record<BorrowStatus, string> = { pending: 'بانتظار المالك', accepted: 'محجوز · بانتظار الاستلام', borrowed: 'مُعار', return_requested: 'بانتظار تأكيد الإرجاع', returned: 'تم الإرجاع', rejected: 'لم يُقبل الطلب', cancelled: 'ملغى', disputed: 'قيد مراجعة النزاع' };
export function borrowActions(status: BorrowStatus, owner: boolean, pickupConfirmed: boolean): { action: string; label: string }[] {
  if (status === 'pending') return owner ? [{ action: 'accept', label: 'قبول الطلب' }, { action: 'reject', label: 'رفض الطلب' }] : [{ action: 'cancel', label: 'إلغاء الطلب' }];
  if (status === 'accepted') return [...(pickupConfirmed ? [] : [{ action: 'pickup', label: owner ? 'تأكيد تسليم الغرض' : 'تأكيد استلام الغرض' }]), { action: 'cancel', label: 'إلغاء الحجز' }, { action: 'dispute', label: 'فتح بلاغ نزاع' }];
  if (status === 'borrowed') return [...(owner ? [] : [{ action: 'return', label: 'أعدت الغرض للمالك' }]), { action: 'dispute', label: 'فتح بلاغ نزاع' }];
  if (status === 'return_requested') return [...(owner ? [{ action: 'confirm_return', label: 'تأكيد استلام الغرض مُعادًا' }] : []), { action: 'dispute', label: 'فتح بلاغ نزاع' }];
  return [];
}
export function parseBorrowDays(value: string, max: number): number | null {
  const normalized = value.trim().replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0));
  if (!/^\d+$/.test(normalized)) return null;
  const days = Number(normalized); return Number.isSafeInteger(days) && days >= 1 && days <= max ? days : null;
}
export function saudiDate(now = new Date()): string { return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10); }
