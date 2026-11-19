/** Public presentation only. Never grant privileges from account_type or a badge. */
export type PublicProfileType = 'standard'|'merchant'|'freelance'|'provider'|'idea'|'admin';
export type ActivityTab = 'questions'|'answers'|'services'|'requests'|'market'|'reviews';
export type PublicProfileIdentity = {
 role?:string|null; account_type?:string|null; is_verified?:boolean|null;
 is_verified_merchant?:boolean|null; verification_status?:string|null; freelance_trade?:string|null;
};
export type ProfileCapabilityFlags = {
 role?:string|null; can_publish_products?:boolean; can_publish_services?:boolean;
 can_manage_business?:boolean; can_promote?:boolean;
};
const DEFAULT_ORDER=['stats','identity','featured','bio','services','questions','products','requests','reviews','achievements'];
const PRIORITY:Record<PublicProfileType, ActivityTab[]>={
 standard:['questions','requests','market','services','reviews','answers'],
 merchant:['market','services','reviews','questions','requests','answers'],
 freelance:['services','market','reviews','questions','requests','answers'],
 provider:['services','reviews','questions','market','requests','answers'],
 idea:['requests','questions','services','market','reviews','answers'],
 admin:['questions','requests','services','market','reviews','answers'],
};
const REMAP:Record<ActivityTab,string>={questions:'questions',answers:'answers',services:'services',requests:'requests',market:'products',reviews:'reviews'};
export function publicProfileType(profile:Pick<PublicProfileIdentity,'role'|'account_type'>):PublicProfileType {
 if(profile.role==='admin')return 'admin';
 if(profile.account_type==='merchant'||profile.account_type==='freelance'||profile.account_type==='provider'||profile.account_type==='idea')return profile.account_type;
 return 'standard';
}
export function publicProfileVerification(profile:PublicProfileIdentity,own=false):{label:string;state:'official'|'verified'|'pending'|'rejected'|'unverified';note:string} {
 const kind=publicProfileType(profile);
 if(kind==='admin')return {label:'حساب إدارة المنصة',state:'official',note:'صلاحية إدارية مخصصة من النظام'};
 if(profile.is_verified===true)return {label:'حساب موثّق',state:'verified',note:'اعتمدت الإدارة توثيق الحساب'};
 const status=String(profile.verification_status||'').toLowerCase();
 if(status==='pending'||status==='under_review')return own?{label:'التوثيق قيد المراجعة',state:'pending',note:'لم يُعتمد الطلب بعد، ولم تتغير الصلاحيات'}:{label:'التوثيق غير مكتمل',state:'unverified',note:'لا توجد شارة توثيق معتمدة'};
 if(status==='rejected')return own?{label:'طلب التوثيق غير معتمد',state:'rejected',note:'يمكن مراجعة المتطلبات وإعادة التقديم'}:{label:'حساب غير موثّق',state:'unverified',note:'لم يحصل الحساب على توثيق معتمد'};
 return {label:'حساب غير موثّق',state:'unverified',note:'نوع الحساب لا يعني التوثيق تلقائيًا'};
}
export function publicProfileRoleCopy(profile:PublicProfileIdentity) {
 const kind=publicProfileType(profile);
 const professional=typeof profile.freelance_trade==='string'?profile.freelance_trade.trim():'';
 const data={
  standard:{label:'حساب فردي',title:'جار من مجتمع حيّنا',detail:'الاستفسارات والمشاركات ومبادرات الجيرة'},
  merchant:{label:'نشاط تجاري',title:'واجهة النشاط التجاري',detail:'المنتجات والخدمات وتقييمات العملاء'},
  freelance:{label:'عمل حر',title:'ملف مهني مستقل',detail:'الأعمال والخدمات والخبرة المهنية'},
  provider:{label:'مقدم خدمة',title:'خدمات لأهل الحي',detail:'الخدمات والتقييمات ومشاركات المجتمع'},
  idea:{label:'مبادرة مجتمعية',title:'مشروع يخدم المجتمع',detail:'المبادرات والطلبات ومساهمات الجيران'},
  admin:{label:'إدارة حيّنا',title:'حساب إدارة المنصة',detail:'المشاركة والتواصل الرسمي في المجتمع'},
 }[kind];
 return {...data,kind,professional:kind==='merchant'||kind==='freelance'||kind==='provider'||kind==='idea'?professional:''};
}
export function profileTabLabel(profile:PublicProfileIdentity,tab:ActivityTab):string {
 const kind=publicProfileType(profile);
 const common:Record<ActivityTab,string>={questions:'الاستفسارات',answers:'الإجابات',services:'الخدمات',requests:'الطلبات',market:'السوق',reviews:'التقييمات'};
 if(kind==='merchant' && tab==='market')return 'منتجات المحل';
 if(kind==='merchant' && tab==='reviews')return 'آراء العملاء';
 if((kind==='freelance'||kind==='provider')&&tab==='services')return 'الأعمال والخدمات';
 if(kind==='idea'&&tab==='requests')return 'طلبات المبادرة';
 return common[tab];
}
export function profileActivityOrder(profile:PublicProfileIdentity,order?:unknown):ActivityTab[]{
 const preferred=PRIORITY[publicProfileType(profile)];
 // Respect deliberate profile design edits; ignore the generic order saved by the default studio.
 const custom=Array.isArray(order)&&order.every(v=>typeof v==='string')
   && order.length>0 && order.join('|')!==DEFAULT_ORDER.join('|');
 if(!custom)return [...preferred];
 const withIndex=(key:ActivityTab)=>{
   const customIndex=order.indexOf(REMAP[key]);
   return customIndex>=0?customIndex:100+preferred.indexOf(key);
 };
 return [...preferred].sort((a,b)=>withIndex(a)-withIndex(b));
}
export function profileStartingTab(profile:PublicProfileIdentity,counts:Partial<Record<ActivityTab,number>>,visible:ActivityTab[],customOrder?:unknown):ActivityTab|undefined {
 const ordered=profileActivityOrder(profile,customOrder).filter(t=>visible.includes(t));
 return ordered.find(tab=>Number(counts[tab]||0)>0)||ordered[0];
}
export function profileOwnerLinks(caps:ProfileCapabilityFlags|undefined):Array<'products'|'services'|'business'|'promotion'>{
 if(!caps)return [];
 const links:Array<'products'|'services'|'business'|'promotion'>=[];
 if(caps.can_publish_products===true)links.push('products');
 if(caps.can_publish_services===true)links.push('services');
 if(caps.can_manage_business===true)links.push('business');
 if(caps.can_promote===true)links.push('promotion');
 return links;
}
