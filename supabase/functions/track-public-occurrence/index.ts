import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (b) => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const { token } = await req.json();
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return json({ error: "QR Code inválido ou incompleto." }, 400);

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "Serviço temporariamente indisponível." }, 503);

    const hash = await sha256(token);
    const occurrenceResponse = await fetch(
      `${url}/rest/v1/ocorrencias?public_tracking_token_hash=eq.${hash}&select=protocolo,categoria,status,created_at,updated_at&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) },
    );
    if (!occurrenceResponse.ok) return json({ error: "Não foi possível consultar a solicitação." }, 502);
    const rows = await occurrenceResponse.json();
    const occurrence = rows?.[0];
    if (!occurrence) return json({ error: "QR Code inválido ou solicitação não encontrada." }, 404);

    const result: Record<string, unknown> = {
      protocolo: occurrence.protocolo,
      categoria: occurrence.categoria,
      status: occurrence.status,
      registrada_em: occurrence.created_at,
      atualizada_em: occurrence.updated_at,
      encerrada: occurrence.status === "encerrada",
    };

    // Do not expose the final narrative until the CAD has explicitly closed the case.
    if (occurrence.status === "encerrada") {
      const historyResponse = await fetch(
        `${url}/rest/v1/ocorrencia_historico?select=acao,observacao,criado_em&status_novo=eq.encerrada&ocorrencia_id=in.(select%20id%20from%20ocorrencias%20where%20public_tracking_token_hash%20eq%20'${hash}')&order=criado_em.desc&limit=1`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) },
      );
      // History query may be restricted by PostgREST syntax/version; use occurrence id only after token match.
      if (historyResponse.ok) {
        const history = await historyResponse.json();
        const note = typeof history?.[0]?.observacao === "string" ? history[0].observacao : "";
        result.desfecho = note.replace(/^\[OPERADOR_FUNCIONAL:[^\]]*\]\s*/i, "").trim() || "Atendimento encerrado. Não há desfecho público registrado.";
        result.encerrada_em = history?.[0]?.criado_em ?? occurrence.updated_at;
      } else {
        result.desfecho = "Atendimento encerrado. Consulte a Central da GCM para informações adicionais.";
        result.encerrada_em = occurrence.updated_at;
      }
    }

    return json(result);
  } catch {
    return json({ error: "Não foi possível consultar a solicitação. Tente novamente." }, 400);
  }
});
