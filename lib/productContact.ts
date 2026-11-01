export function productContactState(v:{signedIn:boolean;own:boolean;available:boolean;canView:boolean;canMessage:boolean;failed:boolean}){
 if(v.own)return {label:'إدارة المنتج',reason:'هذا إعلانك. يمكنك تعديل تفاصيله وحالته.',action:'manage' as const};
 if(!v.available)return {label:'غير متاح للطلب',reason:'الإعلان غير متاح حاليًا. لا يمكن إرسال طلب شراء له.',action:'unavailable' as const};
 if(!v.signedIn)return {label:'سجّل الدخول للتواصل',reason:'سجّل الدخول للتحقق من نطاقك وإعدادات التواصل مع البائع.',action:'signin' as const};
 if(v.failed)return {label:'أعد التحقق من التواصل',reason:'تعذر التحقق من صلاحية التواصل. حالة المنتج لا تعني أن الاتصال اكتمل.',action:'retry' as const};
 if(v.canMessage)return {label:'اطلب المنتج',reason:'راسل البائع للاستفسار، أو أرسل الكمية والملاحظات عبر طلب المنتج. لا يُحجز المنتج تلقائيًا.',action:'request' as const};
 return {label:'التواصل مقيّد',reason:v.canView?'يمكنك عرض الملف، لكن المراسلة غير مسموحة بحسب إعدادات الخاص أو نطاق المنطقة.':'بيانات البائع والتواصل محميان بحسب نطاق الحساب وإعدادات الخصوصية. ظهور الإعلان لا يمنح صلاحية المراسلة.',action:'restricted' as const};
}
