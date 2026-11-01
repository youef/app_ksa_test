export type PayPalQuote={order_id:string;quote:{id:string;currency:'USD';amount_minor:number;source_currency:'SAR';source_amount_minor:number;rate_micros:number;expires_at:string;environment:'sandbox'|'live'}};
export function readPayPalQuote(value:unknown):PayPalQuote|null{
 const v=value as PayPalQuote,q=v?.quote,id=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!v||typeof v.order_id!=='string'||!id.test(v.order_id)||!q||!id.test(q.id)||q.currency!=='USD'||q.source_currency!=='SAR'||!['sandbox','live'].includes(q.environment))return null;
 if(![q.amount_minor,q.source_amount_minor,q.rate_micros].every(n=>Number.isSafeInteger(n)&&n>0)||q.amount_minor>100000000||q.source_amount_minor>100000000||q.rate_micros>10000000000||q.amount_minor!==Math.round(q.source_amount_minor*1000000/q.rate_micros)||!Number.isFinite(Date.parse(q.expires_at)))return null;
 return v;
}
export const paypalUsd=(cents:number)=>new Intl.NumberFormat('ar-SA',{style:'currency',currency:'USD'}).format(cents/100);
export function paypalQuoteDescription(value:PayPalQuote):string{
 const q=value.quote,sar=new Intl.NumberFormat('ar-SA',{style:'currency',currency:'SAR'}).format(q.source_amount_minor/100);
 return `${q.environment==='sandbox'?'وضع تجريبي — لا خصم حقيقي.\n\n':''}قيمة الطلب في السوق: ${sar}\nالمبلغ المرسل إلى PayPal: ${paypalUsd(q.amount_minor)}\nسعر التحويل لهذا الطلب: الدولار = ${(q.rate_micros/1000000).toLocaleString('ar-SA',{maximumFractionDigits:6})} ريال.\n\nالتحصيل بالدولار. راجع العملة والرسوم الظاهرة داخل PayPal قبل تأكيد الدفع. لن يُعتبر الطلب مدفوعًا بمجرد العودة للتطبيق.`;
}
