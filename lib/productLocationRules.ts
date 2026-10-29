export type ProductPosition = { latitude: number; longitude: number; accuracy: number; timestamp: number; mocked?: boolean };
export const PRODUCT_LOCATION_MAX_AGE = 120_000;
export function productPositionError(position: ProductPosition, now = Date.now()): string | null {
  if (![position.latitude, position.longitude, position.accuracy, position.timestamp].every(Number.isFinite) || Math.abs(position.latitude) > 90 || Math.abs(position.longitude) > 180) return 'تعذر قراءة الموقع بصورة صحيحة. أعد المحاولة.';
  if (position.mocked) return 'أوقف الموقع التجريبي واستخدم موقع الجهاز الفعلي.';
  if (position.timestamp > now + 5000 || now - position.timestamp > PRODUCT_LOCATION_MAX_AGE) return 'قراءة الموقع قديمة. أعد تحديد موقعك الحالي.';
  if (position.accuracy < 0 || position.accuracy > 100) return `دقة الموقع ${position.accuracy > 0 ? `نحو ${Math.ceil(position.accuracy).toLocaleString('ar-SA')} متر` : 'غير معروفة'} ولا تكفي للنشر. فعّل الموقع الدقيق وجرّب قرب نافذة أو في مكان مفتوح.`;
  return null;
}
export function productPositionDistance(a: ProductPosition, b: ProductPosition): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b.latitude-a.latitude)*rad/2)**2 + Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin((b.longitude-a.longitude)*rad/2)**2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));
}
export function confirmProductPosition(anchor: ProductPosition, current: ProductPosition, now = Date.now()): void {
  const anchorError=productPositionError(anchor,now);
  if(anchorError)throw new Error(anchorError);
  const error = productPositionError(current, now);
  if (error) throw new Error(error);
  if (productPositionDistance(anchor,current) > 150) throw new Error('ابتعدت عن موقع المنتج الذي أكّدته. أعد تحديد الموقع وأكّد وجود المنتج معك.');
}
export function normalizeProductNumber(value: string): string {
  return value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/٫/g,'.');
}
export function parseProductPrice(value: string): number | null {
  const raw = normalizeProductNumber(value);
  if(/[٬,]/.test(raw) && !/^\d{1,3}([٬,]\d{3})+(\.\d{1,2})?$/.test(raw))return NaN;
  const normalized = raw.replace(/[٬,]/g,'');
  if (!normalized) return null;
  return /^\d{1,7}(\.\d{1,2})?$/.test(normalized) && Number(normalized)>0 ? Number(normalized) : NaN;
}
