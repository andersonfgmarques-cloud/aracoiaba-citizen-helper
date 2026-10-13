import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

function validMagic(bytes: Uint8Array, mime: string) {
  if (mime === "application/pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  if (mime === "image/webp") return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Método não permitido." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return respond({ error: "Configuração do servidor incompleta." }, 500);

    const body = await req.json().catch(() => null) as { protocol?: string; path?: string; token?: string } | null;
    const protocol = body?.protocol?.trim() ?? "";
    const path = body?.path?.trim() ?? "";
    const token = body?.token?.trim() ?? "";

    if (!/^GCM-[0-9]{4}-[0-9]{6}$/.test(protocol) || !/^[a-f0-9]{32}$/.test(token) || !path.startsWith(protocol + "/" + token + "/")) {
      return respond({ error: "Referência do documento inválida." }, 400);
    }
    const parts = path.split("/");
    if (parts.length !== 3 || !parts[2] || parts[2].includes("..")) return respond({ error: "Caminho do documento inválido." }, 400);

    const hash = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: occurrence, error: occurrenceError } = await admin
      .from("ocorrencias")
      .select("protocolo,categoria,descricao,created_at,anexo_token_hash")
      .eq("protocolo", protocol)
      .eq("anexo_token_hash", hash)
      .in("categoria", ["Violência doméstica", "Descumprimento de medida protetiva de urgência"])
      .maybeSingle();

    if (occurrenceError || !occurrence || occurrence.anexo_token_hash !== hash) {
      return respond({ error: "Protocolo ou autorização do anexo inválidos." }, 403);
    }
    const createdAt = Date.parse(occurrence.created_at);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 30 * 60 * 1000 || createdAt > Date.now() + 60_000) {
      return respond({ error: "A autorização para anexar este documento expirou." }, 403);
    }
    if (occurrence.descricao.includes("[ANEXO_MEDIDA_PROTETIVA: path=")) {
      return respond({ error: "Já existe um documento vinculado a esta ocorrência." }, 409);
    }

    const { data: file, error: downloadError } = await admin.storage.from("gcm-medidas-protetivas").download(path);
    if (downloadError || !file) return respond({ error: "Arquivo não encontrado no armazenamento privado." }, 404);
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) return respond({ error: "O arquivo excede o limite permitido." }, 413);

    const mime = file.type || "";
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mime)) {
      return respond({ error: "Formato de arquivo não permitido." }, 415);
    }
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!validMagic(bytes, mime)) return respond({ error: "O conteúdo do arquivo não corresponde ao formato declarado." }, 415);

    const newDescription = occurrence.descricao
      .replace("[ANEXO_MEDIDA_PROTETIVA: PENDENTE; ARQUIVO_SELECIONADO]", "")
      .trimEnd() + "\n[ANEXO_MEDIDA_PROTETIVA: path=" + path + "]";

    const { data: updated, error: updateError } = await admin
      .from("ocorrencias")
      .update({ descricao: newDescription, anexo_token_hash: null })
      .eq("protocolo", protocol)
      .eq("anexo_token_hash", hash)
      .eq("created_at", occurrence.created_at)
      .select("protocolo")
      .maybeSingle();

    if (updateError || !updated) return respond({ error: "Não foi possível vincular o documento; a autorização pode ter expirado ou sido usada." }, 409);
    return respond({ ok: true, protocol });
  } catch (error) {
    console.error("Erro ao vincular documento protetivo:", error);
    return respond({ error: "Falha interna ao vincular o documento." }, 500);
  }
});
