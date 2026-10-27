import { createClient } from "npm:@supabase/supabase-js@2";
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (req.headers.get("authorization") !== `Bearer ${key}`) return new Response("Forbidden", { status: 403 });
  const client = createClient(url, key, { auth: { persistSession: false } });
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let removed = 0, failed = 0, scanned = 0;
  const queue = [""];
  while (queue.length && scanned < 5000) {
    const prefix = queue.shift()!;
    for (let offset = 0; offset < 5000; offset += 100) {
      const { data, error } = await client.storage.from("story-media").list(prefix, { limit: 100, offset });
      if (error) return Response.json({ removed, failed, error: error.message }, { status: 500 });
      if (!data?.length) break;
      for (const obj of data) {
        if (!obj.id) { queue.push(prefix ? prefix + "/" + obj.name : obj.name); continue; }
        scanned++;
        if (!obj.created_at || new Date(obj.created_at).getTime() > cutoff) continue;
        const path = prefix ? prefix + "/" + obj.name : obj.name;
        const { data: stories, error: lookupError } = await client.from("stories").select("id").like("image_url", "%" + path.replace(/[\\%_]/g, "\\$&") + "%").limit(1);
        if (lookupError) { failed++; continue; }
        if (stories?.length) continue;
        const { error: removeError } = await client.storage.from("story-media").remove([path]);
        if (removeError) failed++; else removed++;
      }
      if (data.length < 100) break;
    }
  }
  return Response.json({ scanned, removed, failed });
});