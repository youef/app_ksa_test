export const marketplaceMoney=(amount:number)=>new Intl.NumberFormat('ar-SA',{style:'currency',currency:'SAR'}).format((Number(amount)||0)/100);
export const marketplaceStatus:Record<string,string>={pending:'بانتظار الدفع',paid:'مدفوع',failed:'فشل الدفع',cancelled:'ملغى',refunded:'مسترد',expired:'منتهي',pending_payment:'بانتظار الدفع',pending_review:'قيد المراجعة',active:'نشط',paused:'متوقف مؤقتًا',rejected:'غير معتمد',ended:'انتهت الحملة',accepted:'مقبول',in_progress:'قيد التنفيذ',completed:'مكتمل',payment_failed:'فشل الدفع'};
export function safeMarketplaceCheckout(value:unknown):string|null{
 if(typeof value!=='string')return null;
 try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port)return null;if(['www.paypal.com','www.sandbox.paypal.com'].includes(url.hostname))return url.pathname==='/checkoutnow'&&/^[A-Z0-9]{5,64}$/.test(url.searchParams.get('token')||'')?url.href:null;return ['moyasar.com','tap.company'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host))?url.href:null;}catch{return null;}
}
export function marketplaceError(error:unknown):string{
 const message=(error as {message?:string})?.message||'';
 if(/verified_market_account_required/.test(message))return 'هذه الميزة متاحة للحسابات المهنية المعتمدة.';
 if(/invalid_transition|campaign_already_reviewed/.test(message))return 'تغيرت حالة الطلب. حدّث الصفحة ثم حاول مجددًا.';
 if(/permission|authentication/.test(message))return 'لا تملك صلاحية هذا الإجراء أو انتهت جلستك.';
 return 'تعذر إكمال الإجراء. تحقق من الاتصال وحاول مجددًا.';
}
