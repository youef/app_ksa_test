/** Product cart UI helpers. Pricing authority always remains in the database. */
export type MarketCartLine = {
  item_id: string;
  quantity: number;
  expected_price: number | null;
  fulfillment: string;
  note: string;
};
export function availableProductFulfillments(description?: string | null): string[] {
  const value = String(description || '').match(/(?:^|\n)الاستلام:\s*([^\n]+)/u)?.[1]?.trim();
  if (value === 'استلام من الموقع') return ['استلام من الموقع'];
  if (value === 'توصيل بالتنسيق') return ['توصيل بالتنسيق'];
  if (value === 'استلام أو توصيل') return ['استلام من الموقع', 'توصيل بالتنسيق'];
  return ['بالاتفاق مع البائع'];
}
export function marketCartTotals(lines: Array<Pick<MarketCartLine,'quantity'|'expected_price'>>): { halalas: number; unknown: number; count: number } {
  let halalas = 0, unknown = 0, count = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) throw new Error('كمية غير صحيحة في السلة.');
    count += line.quantity;
    if (line.expected_price == null) { unknown++; continue; }
    if (!Number.isFinite(line.expected_price) || line.expected_price < 0) throw new Error('تعذر التحقق من سعر منتج في السلة.');
    halalas += Math.round(line.expected_price * 100) * line.quantity;
  }
  return { halalas, unknown, count };
}
export function formatCartMoney(halalas: number): string {
  return new Intl.NumberFormat('ar-SA',{style:'currency',currency:'SAR'}).format(halalas/100);
}
export const productOrderStages = [
  {status:'pending',label:'بانتظار موافقة التاجر'},
  {status:'accepted',label:'قيد التجهيز'},
  {status:'ready',label:'جاهز للتسليم أو التوصيل'},
  {status:'completed',label:'تم الاستلام'},
] as const;
export function productOrderStatus(status: string): string {
  return productOrderStages.find(step=>step.status===status)?.label ||
    ({rejected:'مرفوض',cancelled:'ملغي'} as Record<string,string>)[status] || status;
}
