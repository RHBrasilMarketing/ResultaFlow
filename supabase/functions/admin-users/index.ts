// Admin user management — list / delete / set password / reset link / role
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!jwt) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) return json({ error: "Sessão inválida" }, 401);
    const callerId = userData.user.id;

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", callerId);
    if (!roles?.some((r) => r.role === "admin")) return json({ error: "Apenas administradores" }, 403);

    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "";
    const userId: string = body.userId ?? "";

    if (action === "list") {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) throw error;
      return json({
        users: data.users.map((u) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          confirmed: !!u.email_confirmed_at,
        })),
      });
    }

    if (!userId) return json({ error: "userId obrigatório" }, 400);
    if (userId === callerId && (action === "delete")) return json({ error: "Não é possível excluir a própria conta" }, 400);

    if (action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "set_password") {
      const password: string = body.password ?? "";
      if (password.length < 6) return json({ error: "Senha deve ter ao menos 6 caracteres" }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "reset_link") {
      const { data: u } = await admin.auth.admin.getUserById(userId);
      if (!u.user?.email) return json({ error: "Usuário sem email" }, 400);
      const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: u.user.email });
      if (error) throw error;
      return json({ link: data.properties?.action_link });
    }

    if (action === "set_role") {
      const role: string = body.role === "admin" ? "admin" : "user";
      await admin.from("user_roles").delete().eq("user_id", userId);
      const { error } = await admin.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("admin-users error:", e);
    return json({ error: (e as Error).message }, 400);
  }
});
