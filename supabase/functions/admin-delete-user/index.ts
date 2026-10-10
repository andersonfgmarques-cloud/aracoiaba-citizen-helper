import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Método não permitido." }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return new Response(JSON.stringify({ error: "Configuração segura do servidor incompleta." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token || token === authorization) return new Response(JSON.stringify({ error: "Sessão administrativa obrigatória." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
  const caller = callerData.user;
  if (callerError || !caller || caller.email?.toLowerCase() !== "andersonf.g.marques@gmail.com") {
    return new Response(JSON.stringify({ error: "Ação restrita à conta administrativa autorizada." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: { user_id?: string; reason?: string };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Requisição inválida." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
  const targetId = body.user_id?.trim();
  const reason = body.reason?.trim() ?? "";
  if (!targetId || reason.length < 5) return new Response(JSON.stringify({ error: "Selecione uma conta e informe um motivo com pelo menos 5 caracteres." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (targetId === caller.id) return new Response(JSON.stringify({ error: "A conta administrativa atual não pode ser excluída." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: targetData, error: targetError } = await admin.auth.admin.getUserById(targetId);
  if (targetError || !targetData.user) return new Response(JSON.stringify({ error: "Conta não encontrada." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const targetEmail = targetData.user.email ?? null;

  const { data: roles, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", targetId);
  if (roleError) return new Response(JSON.stringify({ error: "Não foi possível validar as permissões da conta." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if ((roles ?? []).some((row) => row.role === "admin") || targetEmail?.toLowerCase() === "andersonf.g.marques@gmail.com") {
    return new Response(JSON.stringify({ error: "A conta administrativa protegida não pode ser excluída." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Preserve the audit trail before deleting the authentication identity.
  const { error: auditError } = await admin.from("cad_admin_audit").insert({
    actor_user_id: caller.id,
    actor_email: caller.email ?? "administrador",
    action: "user_account_deletion_requested",
    target_user_id: targetId,
    details: { target_email: targetEmail, reason, requested_at: new Date().toISOString() },
  });
  if (auditError) return new Response(JSON.stringify({ error: "Exclusão cancelada: não foi possível registrar a auditoria." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
  if (deleteError) {
    await admin.from("cad_admin_audit").insert({
      actor_user_id: caller.id,
      actor_email: caller.email ?? "administrador",
      action: "user_account_deletion_failed",
      target_user_id: targetId,
      details: { target_email: targetEmail, reason, error: deleteError.message },
    });
    return new Response(JSON.stringify({ error: "O Supabase não concluiu a exclusão da conta: " + deleteError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  await admin.from("cad_admin_audit").insert({
    actor_user_id: caller.id,
    actor_email: caller.email ?? "administrador",
    action: "user_account_deleted",
    target_user_id: targetId,
    details: { target_email: targetEmail, reason },
  });
  return new Response(JSON.stringify({ success: true, email: targetEmail }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
