import { createClient } from "npm:@supabase/supabase-js@2";
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const token = req.headers.get("x-hayna-cleanup-token") ?? "";
  if (!/^[0-9a-f]{64}$/.test(token)) return new Response("Forbidden", { status: 403 });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return new Response("Server not configured", { status: 500 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authorized, error: authError } = await db.rpc("hayna_consume_story_cleanup_token", { p_token: token });
  if (authError || authorized !== true) return new Response("Forbidden", { status: 403 });
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let scanned = 0, removed = 0, failed = 0, protectedCount = 0;
  const queue = [""];
  while (queue.length && scanned < 2000) {
    const prefix = queue.shift()!;
    const { data, error } = await db.storage.from("story-media").list(prefix, { limit: 1000, offset: 0, sortBy: { column: "created_at", order: "asc" } });
    if (error) return Response.json({ scanned, removed, failed, error: error.message }, { status: 500 });
    for (const object of data ?? []) {
      if (!object.id) {
        queue.push(prefix ? prefix + "/" + object.name : object.name);
        continue;
      }
      scanned++;
      if (scanned > 2000) break;
      const created = Date.parse(object.created_at ?? "");
      if (!Number.isFinite(created) || created > cutoff) continue;
      const path = prefix ? prefix + "/" + object.name : object.name;
      const escaped = path.replace(/[\\%_]/g, "\\$&");
      const { data: linked, error: lookupError } = await db.from("stories")
        .select("id").ilike("image_url", "%" + escaped + "%").limit(1);
      if (lookupError) { failed++; continue; }
      if (linked?.length) { protectedCount++; continue; }
      const { error: removeError } = await db.storage.from("story-media").remove([path]);
      if (removeError) failed++; else removed++;
    }
  }
  return Response.json({ scanned, removed, failed, protected: protectedCount, pendingFolders: queue.length });
});