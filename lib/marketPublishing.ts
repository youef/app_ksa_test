export type MarketCapabilities = {
  can_publish_products: boolean; can_publish_services: boolean; can_manage_business: boolean; can_publish_events: boolean;
};
export const NO_MARKET_ACCESS: MarketCapabilities = { can_publish_products: false, can_publish_services: false, can_manage_business: false, can_publish_events: false };
export function parseMarketCapabilities(value: unknown): MarketCapabilities {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.keys(NO_MARKET_ACCESS).map(key => [key, row[key] === true])) as MarketCapabilities;
}
export const SERVICE_ACTIVITY_IDS = ['repair', 'remote', 'education', 'delivery'] as const;
export function marketPublishingError(error: unknown): string {
  const message = (error as { message?: string })?.message || '';
  if (/verified_market_account_required|row.level security|permission denied|verified_merchant_required/i.test(message)) return 'النشر متاح للحسابات المهنية المعتمدة حسب نوع الحساب. راجع حالة توثيقك.';
  if (/verified_profile_location_required|merchant_business_required/i.test(message)) return 'تعذر تأكيد موقع الحساب أو ربط المنشأة. أعد تحديث البيانات ثم حاول مجددًا.';
  if (/PGRST116|single JSON object|0 rows/i.test(message)) return 'لم يُنشر العرض. راجع المحتوى وصلاحية حسابك ثم حاول مجددًا.';
  return message || 'تعذر حفظ العرض. تحقق من الاتصال ثم حاول مجددًا.';
}
