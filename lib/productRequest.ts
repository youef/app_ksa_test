export function productRequestTotal(price: unknown, quantity: number): number | null {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('اختر كمية من ١ إلى ٢٠.');
  if (price === null || price === undefined || price === '') return null;
  const number = Number(price);
  if (!Number.isFinite(number) || number < 0 || number > 9999999) throw new Error('تعذر التحقق من سعر المنتج.');
  return Math.round(number * 100) * quantity;
}

/** A purchase enquiry in the existing private conversation, never a paid order or reservation. */
export async function sendProductRequest(client: any, input: { itemId: string; requestId: string; quantity: number; note: string; expectedPrice: unknown }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId) || input.note.trim().length > 400) throw new Error('راجع بيانات الطلب وأعد المحاولة.');
  productRequestTotal(input.expectedPrice, input.quantity);
  const auth = await client.auth.getUser();
  const sender = auth.data?.user?.id;
  if (auth.error || !sender) throw new Error('سجّل الدخول لإرسال طلب المنتج.');
  const existing = async () => {
    const result = await client.from('messages').select('id,conversation_id').eq('id', input.requestId).eq('sender_id', sender).maybeSingle();
    if (result.error) throw new Error('تعذر التحقق من الطلب السابق. حاول عند استقرار الاتصال.');
    return result.data?.conversation_id || null;
  };
  const prior = await existing();
  if (prior) return { conversationId: prior, reused: true };
  const result = await client.from('marketplace_items').select('id,seller_id,title,price,item_type,status').eq('id', input.itemId).maybeSingle();
  if (result.error || !result.data) throw new Error('المنتج غير متاح حاليًا. حدّث الصفحة.');
  const item = result.data;
  if (item.seller_id === sender) throw new Error('لا يمكنك طلب منتجك.');
  if (item.status !== 'available') throw new Error('لم يعد المنتج متاحًا للطلب.');
  const total = productRequestTotal(item.price, input.quantity);
  if (productRequestTotal(item.price, 1) !== productRequestTotal(input.expectedPrice, 1)) throw new Error('تغيّر سعر المنتج. حدّث الصفحة وراجع السعر قبل إرسال الطلب.');
  const access = await client.rpc('hayna_neighbor_access', { p_lookup: item.seller_id, p_scope: 'district' });
  if (access.error || access.data?.can_message !== true) throw new Error('إعدادات الخاص أو نطاق الحي لا تسمح بإرسال الطلب.');
  const conversation = await client.rpc('hayna_get_or_create_direct_conversation', { p_target: item.seller_id });
  if (conversation.error || !conversation.data) throw new Error('تعذر تجهيز المحادثة. لم يُرسل الطلب.');
  const money = (value: number) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(value / 100);
  const body = ['طلب منتج من سوق حيّنا', 'المنتج: ' + item.title, 'الكمية المطلوبة: ' + input.quantity.toLocaleString('ar-SA'), total === null ? 'السعر: بالاتفاق مع البائع' : 'الإجمالي التقديري: ' + money(total) + '، قبل تكلفة التسليم', input.note.trim() ? 'ملاحظات: ' + input.note.trim() : '', 'https://appksatest.vercel.app/marketplace-item?id=' + encodeURIComponent(item.id), 'مرجع الطلب: ' + input.requestId, 'هذا طلب شراء؛ التوفر والتسليم والسعر النهائي تحتاج تأكيد البائع.'].filter(Boolean).join('\n');
  const sent = await client.from('messages').insert({ id: input.requestId, sender_id: sender, conversation_id: conversation.data, body }).select('id').single();
  if (sent.error) {
    if (sent.error.code === '23505') { const saved = await existing(); if (saved) return { conversationId: saved, reused: true }; }
    throw new Error('تعذر تأكيد إرسال الطلب. أعد المحاولة؛ سيُستخدم المرجع نفسه لمنع تكراره.');
  }
  if (!sent.data?.id) throw new Error('لم يؤكد الخادم حفظ الطلب. أعد المحاولة بالمرجع نفسه.');
  return { conversationId: conversation.data, reused: false };
}
