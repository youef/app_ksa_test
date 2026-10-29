import { appendAdminAudit, hasAdminPermission, validAdminTarget } from './adminAuthorization.ts';

export async function handleAdminUsers(req: Request,ctx: any): Promise<Response> {
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
 if(!ctx.userClaims?.id)return Response.json({error:'سجّل الدخول أولًا.'},{status:401});
 const body=await req.json().catch(()=>null);
 if(!body || typeof body!=='object' || Array.isArray(body))return Response.json({error:'طلب غير صالح.'},{status:400});
 const action=body.action;
 if(!['list','create','update','delete'].includes(action))return Response.json({error:'عملية غير معروفة.'},{status:400});
 const permission=action==='update'?'roles':'users';
 if(!await hasAdminPermission(ctx,permission))return Response.json({error:'لا تملك صلاحية هذه العملية.'},{status:403});
 try {
  if(action==='list'){
   const limit=Math.min(200,Math.max(1,Number(body.limit)||100));
   const {data,error}=await ctx.supabaseAdmin.from('profiles').select('id,username,display_name,role,is_verified,verification_status,city,district,avatar_url,created_at,is_banned').order('created_at',{ascending:false}).limit(limit);
   if(error)throw new Error('query_failed');
   return Response.json({users:data||[]});
  }
  if(action==='create'){
   const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
   const password=typeof body.password==='string'?body.password:'';
   const username=typeof body.username==='string'?body.username.trim().slice(0,40):'';
   const displayName=typeof body.display_name==='string'?body.display_name.trim().slice(0,80):'';
   const role=body.role??'user';
   if(!['user','moderator'].includes(role) || (role!=='user'&&!await hasAdminPermission(ctx,'roles')))return Response.json({error:'إنشاء دور إداري يتطلب إذن إدارة الصلاحيات.'},{status:403});
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||password.length>128)return Response.json({error:'أدخل بريدًا صالحًا وكلمة مرور من 12 إلى 128 حرفًا.'},{status:400});
   const {data,error}=await ctx.supabaseAdmin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username,display_name:displayName}});
   if(error||!data.user)return Response.json({error:'تعذر إنشاء الحساب. تحقق من البيانات أو وجود حساب سابق.'},{status:400});
   // Only fixed, non-secret profile fields; no automatic admin_permissions or assignments.
   const {error:profileError}=await ctx.supabaseAdmin.from('profiles').update({username:username||null,display_name:displayName||null,role}).eq('id',data.user.id);
   if(profileError){await ctx.supabaseAdmin.auth.admin.deleteUser(data.user.id);throw new Error('profile_creation_failed');}
   await appendAdminAudit(ctx,'admin_user_created',data.user.id,{role});
   return Response.json({ok:true,user:{id:data.user.id}});
  }
  if(!validAdminTarget(body.id))return Response.json({error:'معرّف مستخدم غير صالح.'},{status:400});
  if(action==='update'){
   if(!['user','moderator','admin'].includes(body.role))return Response.json({error:'دور غير صالح.'},{status:400});
   // User-scoped RPC preserves protected-field checks, last-owner protection and transactional audit.
   const {error}=await ctx.supabase.rpc('hayna_admin_set_profile_role',{p_target:body.id,p_role:body.role});
   if(error)return Response.json({error:'تعذر تعديل الدور؛ تحقق من حماية المالك والصلاحيات.'},{status:error.code==='42501'?403:400});
   return Response.json({ok:true});
  }
  if(body.id===ctx.userClaims.id)return Response.json({error:'لا يمكنك حذف حسابك من هنا.'},{status:400});
  // A user manager cannot remove a privileged account or its last owner.
  const [{data:roles,error:roleError},{data:grants,error:grantError}]=await Promise.all([
   ctx.supabaseAdmin.from('admin_role_assignments').select('role_key').eq('user_id',body.id),
   ctx.supabaseAdmin.from('admin_permissions').select('permission').eq('admin_id',body.id).eq('enabled',true),
  ]);
  if(roleError||grantError)throw new Error('permission_lookup_failed');
  if((roles||[]).some((r:any)=>r.role_key==='owner'))return Response.json({error:'أزل دور المالك بأمان قبل أي حذف للحساب.'},{status:403});
  if(((roles||[]).length||(grants||[]).length)&&!await hasAdminPermission(ctx,'roles'))return Response.json({error:'إدارة الحسابات ذات الصلاحيات تتطلب إذن إدارة الأدوار.'},{status:403});
  await appendAdminAudit(ctx,'admin_user_delete_requested',body.id);
  // Database authorization sees the ban immediately; never treat cached JWT role claims as an admin grant.
  const {error:banError}=await ctx.supabaseAdmin.from('profiles').update({is_banned:true}).eq('id',body.id);
  if(banError)throw new Error('ban_failed');
  const {error}=await ctx.supabaseAdmin.auth.admin.deleteUser(body.id,true);
  if(error)throw new Error('delete_failed');
  await appendAdminAudit(ctx,'admin_user_soft_deleted',body.id);
  return Response.json({ok:true});
 }catch{
  return Response.json({error:'تعذر إكمال العملية. راجع سجل الإدارة ثم أعد المحاولة.'},{status:500});
 }
}
