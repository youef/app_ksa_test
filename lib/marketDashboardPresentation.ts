/** Presentation only. Actual marketplace counts and permissions remain server-owned. */
export function marketDashboardCount(value: unknown): string {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return '—';
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return '—';
  // Western digits render reliably with the app's fallback fonts on iOS, Android and web.
  return Math.floor(number).toLocaleString('en-US');
}
export function marketDashboardHasAttention(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
export function marketDashboardAttentionLine(incoming: number | null, ready: number | null): string {
  const pieces: string[] = [];
  if (marketDashboardHasAttention(incoming)) pieces.push(marketDashboardCount(incoming)+' طلب منتج ينتظر موافقتك');
  if (marketDashboardHasAttention(ready)) pieces.push(marketDashboardCount(ready)+' طلب جاهز لاستلامك');
  return pieces.join(' · ');
}
