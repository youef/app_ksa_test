/** The user-scoped RPC is the only authorization source; profile.role is not an admin grant. */
export async function hasAdminPermission(ctx: any, permission: string): Promise<boolean> {
  if (!ctx.userClaims?.id) return false;
  const [{data:profile,error:profileError},{data:allowed,error:permissionError}] = await Promise.all([
    ctx.supabaseAdmin.from('profiles').select('is_banned').eq('id',ctx.userClaims.id).maybeSingle(),
    ctx.supabase.rpc('hayna_has_permission',{p_permission:permission}),
  ]);
  return !profileError && Boolean(profile) && !profile.is_banned && !permissionError && allowed===true;
}
export async function appendAdminAudit(ctx: any,action: string,target: string,metadata: Record<string,unknown>={}) {
  const {error}=await ctx.supabase.from('admin_activity_logs').insert({actor_id:ctx.userClaims.id,action,target_type:'user',target_id:target,metadata});
  if(error)throw new Error('audit_failed');
}
export function validAdminTarget(value: unknown): value is string {
 return typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
