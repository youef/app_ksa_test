export type ProductRequestStatus='pending'|'accepted'|'ready'|'completed'|'rejected'|'cancelled';
export type ProductRequestRecord={id:string;message_id:string|null;conversation_id:string|null;item_id:string|null;buyer_id:string;seller_id:string;item_title:string;unit_price:number|null;quantity:number;fulfillment:string;note:string;status:ProductRequestStatus;version:number;created_at:string;updated_at:string};
export const productRequestLabels:Record<ProductRequestStatus,string>={pending:'بانتظار مراجعة البائع',accepted:'تم القبول والحجز',ready:'جاهز للاستلام',completed:'تم تأكيد الاستلام',rejected:'اعتذر البائع عن الطلب',cancelled:'الطلب ملغى'};
export const productRequestEventLabels:Record<string,string>={created:'أُرسل الطلب للمراجعة',revise:'عدّل المشتري تفاصيل الطلب',accept:'وافق البائع وحجز المنتج',ready:'أكّد البائع جاهزية الطلب',complete:'أكّد المشتري الاستلام',reject:'اعتذر البائع',cancel:'أُلغي الطلب'};
export function productRequestActions(request:ProductRequestRecord,userId:string):string[]{
 if(![request.buyer_id,request.seller_id].includes(userId)||['completed','rejected','cancelled'].includes(request.status))return [];
 const buyer=userId===request.buyer_id;
 if(request.status==='pending')return buyer?['revise','cancel']:['accept','reject'];
 if(request.status==='accepted')return buyer?['cancel']:['ready','cancel'];
 return buyer?['complete','cancel']:['cancel'];
}
export function productRequestError(error:unknown):string {
 const message=String((error as {message?:string})?.message||'');
 const messages:Record<string,string>={authentication_required:'سجّل الدخول بحساب نشط ثم أعد المحاولة.',product_request_forbidden:'هذا الإجراء غير مسموح لحسابك أو لحالة الطلب الحالية.',invalid_product_request:'راجع الكمية والملاحظات قبل إرسال الطلب.',product_unavailable:'المنتج لم يعد متاحًا لهذه الخطوة. حدّث حالته وتواصل مع البائع.',product_contact_restricted:'إعدادات الخاص أو الحظر أو نطاق المنطقة تمنع التواصل حاليًا.',product_price_changed:'تغيّر سعر المنتج. على المشتري مراجعة الطلب وتحديثه بالسعر الحالي قبل القبول.',product_fulfillment_changed:'تغيّرت طرق التسليم. حدّث المنتج واختر طريقة متاحة.',product_request_stale:'تغيّر الطلب من الطرف الآخر. حدّث البطاقة وراجع آخر نسخة قبل التأكيد.',product_request_closed:'الطلب مغلق ولا يمكن تعديله. يمكنك بدء طلب جديد إذا توفر المنتج.',product_request_note_rejected:'تحتوي الملاحظات على نص غير مسموح. عدّلها قبل المتابعة.',product_message_not_saved:'لم تُحفظ رسالة الطلب. راجع النص وأعد المحاولة.'};
 return Object.entries(messages).find(([key])=>message.includes(key))?.[1]||'تعذر تأكيد العملية. حدّث البطاقة ثم أعد المحاولة؛ يُستخدم المرجع نفسه لمنع تكرار الطلب.';
}
