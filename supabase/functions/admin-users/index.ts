import { withSupabase } from "npm:@supabase/server@^1";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    const userId = ctx.userClaims?.id;
    if (!userId) return Response.json({ error: "غير مصرح" }, { status: 401 });

    const { data: me, error: meError } = await ctx.supabaseAdmin
      .from("profiles").select("role,is_banned").eq("id", userId).single();

    if (meError || !me || me.is_banned || !["admin", "moderator"].includes(me.role)) {
      return Response.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const isAdmin = me.role === "admin";

    if (action === "list") {
      const { data, error } = await ctx.supabaseAdmin.from("profiles")
        .select("id,username,display_name,role,is_verified,verification_status,city,district,avatar_url,created_at")
        .order("created_at", { ascending: false }).limit(200);
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json({ users: data ?? [] });
    }

    if (action === "create") {
      if (!isAdmin) return Response.json({ error: "يتطلب إنشاء المستخدمين صلاحية المدير" }, { status: 403 });
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const username = String(body.username || "").trim();
      const displayName = String(body.display_name || "").trim();
      const role = ["user","moderator"].includes(body.role) ? body.role : "user";
      if (!email || password.length < 8) return Response.json({ error: "البريد وكلمة المرور (8 أحرف على الأقل) مطلوبة" }, { status: 400 });
      const { data, error } = await ctx.supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { username, display_name: displayName }
      });
      if (error) return Response.json({ error: error.message }, { status: 400 });
      if (data.user) {
        await ctx.supabaseAdmin.from("profiles").update({ username: username || null, display_name: displayName || null, role }).eq("id", data.user.id);
      }
      return Response.json({ ok: true, user: data.user });
    }

    if (action === "update") {
      if (!isAdmin) return Response.json({ error: "يتطلب تعديل الصلاحيات صلاحية المدير" }, { status: 403 });
      const id = String(body.id || "");
      const role = ["user","moderator","admin"].includes(body.role) ? body.role : "user";
      if (!id) return Response.json({ error: "معرّف المستخدم مطلوب" }, { status: 400 });
      if (id === userId && role !== "admin") return Response.json({ error: "لا يمكنك إزالة صلاحية الإدارة من حسابك" }, { status: 400 });
      const { error } = await ctx.supabaseAdmin.from("profiles").update({ role }).eq("id", id);
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json({ ok: true });
    }

    if (action === "delete") {
      if (!isAdmin) return Response.json({ error: "يتطلب حذف المستخدمين صلاحية المدير" }, { status: 403 });
      const id = String(body.id || "");
      if (!id || id === userId) return Response.json({ error: "لا يمكنك حذف حسابك من هنا" }, { status: 400 });
      const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(id, true);
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "عملية غير معروفة" }, { status: 400 });
  })
};
