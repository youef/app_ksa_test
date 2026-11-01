/** Recognize only the existing product-enquiry format and our own product route. */
export function productMessageId(body: string): string | null {
  if (!body.startsWith('طلب منتج من سوق حيّنا\n')) return null;
  const match = body.match(/^https:\/\/appksatest\.vercel\.app\/marketplace-item\?id=([0-9a-f-]{36})$/im);
  return match && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match[1]) ? match[1] : null;
}
export function productStatusLabel(status: unknown): string {
  return status === 'available' ? 'متاح' : status === 'reserved' ? 'محجوز' : status === 'sold' ? 'مباع' : 'غير متاح';
}
