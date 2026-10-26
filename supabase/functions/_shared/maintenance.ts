import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

export function maintenanceHandler(task: string) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
    const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return reply({ error: 'Authentication required' }, 401);
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return reply({ error: 'Server configuration missing' }, 503);
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    try {
      if (token !== key) {
        const { data: identity, error: authError } = await admin.auth.getUser(token);
        if (authError || !identity.user) return reply({ error: 'Invalid session' }, 401);
        const { data: profile, error: profileError } = await admin.from('profiles')
          .select('role,is_banned').eq('id', identity.user.id).single();
        if (profileError || profile?.role !== 'admin' || profile.is_banned) return reply({ error: 'Admin access required' }, 403);
      }
      const { data, error } = await admin.rpc('backend_run_maintenance', { p_task: task });
      if (error) throw error;
      return reply(data);
    } catch {
      console.error('Backend maintenance failed:', task);
      return reply({ error: 'Maintenance failed' }, 500);
    }
  };
}

