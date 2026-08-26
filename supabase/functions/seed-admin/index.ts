// Função one-shot para criar/garantir o usuário administrador padrão.
// GET ou POST sem body. Idempotente: se já existir, apenas reaplica a senha.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "luhcasasrabello@gmail.com";
const ADMIN_PASSWORD = "160150Vo***";
const ADMIN_USERNAME = "luhcasasrabello";
const ADMIN_COMPANY = "Resulta Flow";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // 1. Verifica se já existe
    const { data: list, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) throw listErr;
    let user = list.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());

    if (user) {
      // Atualiza senha (caso tenha sido perdida) e confirma email
      const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { username: ADMIN_USERNAME, company: ADMIN_COMPANY },
      });
      if (updErr) throw updErr;
    } else {
      // Cria novo
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { username: ADMIN_USERNAME, company: ADMIN_COMPANY },
      });
      if (createErr) throw createErr;
      user = created.user!;
    }

    // 2. Garante perfil
    await admin.from("profiles").upsert({
      id: user.id,
      username: ADMIN_USERNAME,
      company: ADMIN_COMPANY,
      email: ADMIN_EMAIL,
    });

    // 3. Garante papel admin
    const { data: existingRole } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!existingRole) {
      await admin.from("user_roles").insert({ user_id: user.id, role: "admin" });
    }

    return new Response(
      JSON.stringify({ ok: true, email: ADMIN_EMAIL, userId: user.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("seed-admin error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
