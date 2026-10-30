import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ACCOUNT_MEDIA_BUCKETS, accountMediaPrefixes } from "./storageBuckets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "يلزم تسجيل الدخول." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    console.error("Supabase function environment is missing required credentials.");
    return json({ error: "الخدمة غير جاهزة حاليًا. حاول لاحقًا." }, 500);
  }

  const token = authorization.slice("Bearer ".length);
  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) return json({ error: "انتهت جلسة الدخول. سجّل الدخول ثم أعد المحاولة." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // User uploads use an account-id folder in these buckets. Remove through
    // the Storage API before deleting the Auth user (Auth rejects owners with
    // remaining Storage objects). `avatars` also stores story images under a
    // story_<account-id> folder.
    for (const bucket of ACCOUNT_MEDIA_BUCKETS) {
      const prefixes = accountMediaPrefixes(bucket, user.id);
      const paths: string[] = [];
      const listTree = async (prefix: string) => {
        let offset = 0;
        while (true) {
          const { data, error } = await admin.storage.from(bucket).list(prefix, {
            limit: 1000,
            offset,
            sortBy: { column: "name", order: "asc" },
          });
          if (error) throw error;
          const entries = data ?? [];
          for (const entry of entries) {
            const path = `${prefix}/${entry.name}`;
            if (entry.id) paths.push(path);
            else await listTree(path);
          }
          if (entries.length < 1000) break;
          offset += entries.length;
        }
      };

      for (const prefix of prefixes) await listTree(prefix);
      for (let offset = 0; offset < paths.length; offset += 100) {
        const { error } = await admin.storage.from(bucket).remove(paths.slice(offset, offset + 100));
        if (error) throw error;
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return json({ success: true });
  } catch (error) {
    console.error("Account deletion failed for user", user.id, error);
    return json({ error: "تعذّر حذف الحساب الآن. لم يكتمل الحذف؛ حاول مرة أخرى أو تواصل مع الدعم." }, 500);
  }
});
