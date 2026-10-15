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
const sha256 = async (value: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), b => b.toString(16).padStart(2, "0")).join("");

const restHeaders = (key: string) => ({
  apikey: key,
  Authorization: "Bearer " + key,
  "Accept-Profile": "public",
  "Content-Profile": "public",
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const payload = await req.json();
    const token = payload?.token;
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
      return json({ error: "QR Code inválido ou incompleto." }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      console.error("Tracking config missing", { hasUrl: Boolean(url), hasServiceKey: Boolean(key) });
      return json({ error: "Serviço temporariamente indisponível." }, 503);
    }

    const hash = await sha256(token);
    const endpoint = new URL("/rest/v1/ocorrencias", url);
    endpoint.searchParams.set("select", "id,protocolo,categoria,status,created_at,updated_at");
    endpoint.searchParams.set("public_tracking_token_hash", "eq." + hash);
    endpoint.searchParams.set("limit", "1");

    const response = await fetch(endpoint, {
      headers: restHeaders(key),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1000);
      console.error("Tracking occurrence query failed", { status: response.status, detail });
      return json({ error: "O serviço de acompanhamento está temporariamente indisponível. Tente novamente em instantes." }, 502);
    }

    const rows = await response.json();
    const occurrence = rows?.[0];
    if (!occurrence) return json({ error: "Solicitação não encontrada para este QR Code. Confirme se está usando o código original." }, 404);

    const result: Record<string, unknown> = {
      protocolo: occurrence.protocolo,
      categoria: occurrence.categoria,
      status: occurrence.status,
      registrada_em: occurrence.created_at,
      atualizada_em: occurrence.updated_at,
      encerrada: occurrence.status === "encerrada",
    };

    if (occurrence.status === "encerrada") {
      const historyUrl = new URL("/rest/v1/ocorrencia_historico", url);
      historyUrl.searchParams.set("select", "acao,observacao,criado_em");
      historyUrl.searchParams.set("ocorrencia_id", "eq." + occurrence.id);
      historyUrl.searchParams.set("status_novo", "eq.encerrada");
      historyUrl.searchParams.set("order", "criado_em.desc");
      historyUrl.searchParams.set("limit", "1");
      const historyResponse = await fetch(historyUrl, {
        headers: restHeaders(key),
        signal: AbortSignal.timeout(10000),
      });

      if (historyResponse.ok) {
        const history = await historyResponse.json();
        const raw = typeof history?.[0]?.observacao === "string" ? history[0].observacao : "";
        result.desfecho = raw.replace(/^\[OPERADOR_FUNCIONAL:[^\]]*\]\s*/i, "").trim()
          || "Atendimento encerrado. Não há desfecho público registrado.";
        result.encerrada_em = history?.[0]?.criado_em ?? occurrence.updated_at;
      } else {
        console.error("Tracking history query failed", { status: historyResponse.status, detail: (await historyResponse.text()).slice(0, 1000) });
        result.desfecho = "Atendimento encerrado. Consulte a Central da GCM para informações adicionais.";
        result.encerrada_em = occurrence.updated_at;
      }
    }

    return json(result);
  } catch (error) {
    console.error("Tracking function unexpected error", error instanceof Error ? error.message : String(error));
    return json({ error: "Não foi possível consultar a solicitação. Tente novamente." }, 500);
  }
});
