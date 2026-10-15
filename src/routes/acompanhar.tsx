import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, FileText, LoaderCircle, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type TrackingRecord = {
  protocolo: string;
  categoria: string;
  status: string;
  registrada_em: string;
  atualizada_em: string;
  encerrada: boolean;
  desfecho?: string;
  encerrada_em?: string;
};

const statusLabels: Record<string, string> = {
  pendente: "Solicitação recebida",
  despachada: "Equipe acionada",
  em_atendimento: "Ocorrência em atendimento",
  encerrada: "Atendimento encerrado",
  cancelada: "Solicitação cancelada",
};

const statusDescriptions: Record<string, string> = {
  pendente: "Sua solicitação foi registrada e aguarda avaliação e encaminhamento pela Central da GCM.",
  despachada: "A equipe foi acionada. Acompanhe esta página para consultar novas atualizações.",
  em_atendimento: "A equipe está atendendo a ocorrência. O desfecho será disponibilizado após o encerramento pelo CAD.",
  encerrada: "As providências foram concluídas e o atendimento foi encerrado pelo CAD.",
  cancelada: "Esta solicitação consta como cancelada no sistema. Em caso de dúvida, entre em contato com a Central da GCM.",
};

export const Route = createFileRoute("/acompanhar")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [
      { title: "Acompanhar solicitação | GCM Araçoiaba da Serra" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Consulta privada do status de uma solicitação da GCM Araçoiaba da Serra." },
    ],
  }),
  component: AcompanharPage,
});

function formatDate(value?: string) {
  if (!value) return "Não informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Não informado" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function AcompanharPage() {
  const { token } = Route.useSearch();
  const [record, setRecord] = useState<TrackingRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!/^[a-f0-9]{64}$/.test(token)) {
      setError("Este link de acompanhamento é inválido. Utilize o QR Code recebido ao registrar a solicitação.");
      setRecord(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("track-public-occurrence", { body: { token } });
      if (invokeError || data?.error || !data?.protocolo || typeof data?.status !== "string") {
        setRecord(null);
        setError(data?.error || "Não foi possível confirmar o status da solicitação neste momento. Tente novamente em instantes.");
      } else {
        setRecord(data as TrackingRecord);
      }
    } catch {
      setRecord(null);
      setError("Não foi possível estabelecer comunicação para consultar o status. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <style>{`@media print { .no-print { display:none !important; } body { background:white !important; color:#111827 !important; } .tracking-card { box-shadow:none !important; border:1px solid #9ca3af !important; background:white !important; color:#111827 !important; } }`}</style>
      <section className="tracking-card mx-auto max-w-2xl rounded-3xl border bg-card p-5 shadow-xl sm:p-8">
        <header className="mb-6 flex items-center gap-3 border-b pb-5">
          <img src="/aracoiaba-citizen-helper/BrasaoOfc.png" alt="Brasão da GCM Araçoiaba da Serra" className="h-14 w-14 object-contain" />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Guarda Civil Municipal</p>
            <h1 className="text-xl font-black sm:text-2xl">Acompanhamento de solicitação</h1>
          </div>
        </header>

        {loading && !record && <div role="status" className="flex items-center gap-3 py-10 text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" /> Consultando status da solicitação…</div>}
        {error && <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm"><TriangleAlert className="mb-2 h-5 w-5 text-destructive" /><p>{error}</p><p className="mt-2 text-muted-foreground">A mensagem não significa que a ocorrência foi cancelada ou encerrada. O status só será informado após confirmação do sistema.</p><button onClick={() => void load()} disabled={loading} className="no-print mt-3 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 font-semibold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Tentar novamente</button></div>}

        {record && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Protocolo</p>
            <h2 className="mt-1 break-all text-2xl font-black text-primary sm:text-3xl">{record.protocolo}</h2>
            <p className="mt-3 text-sm text-muted-foreground">Categoria: {record.categoria}</p>
            <div className="mt-5 flex items-start gap-3 rounded-xl border p-4">
              {record.encerrada ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" /> : <Clock3 className="mt-0.5 h-6 w-6 shrink-0 text-primary" />}
              <div>
                <p className="font-bold">{statusLabels[record.status] || "Status atualizado"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{statusDescriptions[record.status] || "Sua solicitação está registrada. Consulte novamente para verificar atualizações do CAD."}</p>
                {!record.encerrada && <p className="mt-2 text-sm font-medium">O desfecho ficará disponível nesta página após o encerramento pelo CAD.</p>}
                {record.encerrada && <p className="mt-2 text-sm text-muted-foreground">Encerrada em {formatDate(record.encerrada_em || record.atualizada_em)}.</p>}
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-secondary/70 p-3"><p className="text-muted-foreground">Registrada em</p><p className="mt-1 font-semibold">{formatDate(record.registrada_em)}</p></div>
              <div className="rounded-lg bg-secondary/70 p-3"><p className="text-muted-foreground">Última atualização</p><p className="mt-1 font-semibold">{formatDate(record.atualizada_em)}</p></div>
            </div>
            {record.encerrada && (
              <section className="mt-5 rounded-xl border border-success/40 bg-success/5 p-4">
                <h3 className="flex items-center gap-2 font-bold"><FileText className="h-5 w-5 text-success" /> Desfecho registrado pelo CAD</h3>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{record.desfecho || "Atendimento encerrado. Não há desfecho público registrado."}</p>
                <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">Comprovante de acompanhamento da GCM. Este documento não substitui Boletim de Ocorrência da Polícia Civil.</p>
              </section>
            )}
            <div className="no-print mt-6 flex flex-wrap gap-2">
              <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 font-semibold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar status</button>
              {record.encerrada && <button onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground"><FileText className="h-4 w-4" /> Imprimir / salvar PDF</button>}
            </div>
          </>
        )}

        <footer className="mt-7 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
          <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 shrink-0" /> Consulta protegida por link individual</p>
          <p className="mt-2">Não compartilhe o QR Code. Quem tiver acesso ao link poderá consultar o status desta solicitação. Em situação de risco imediato, ligue 190 ou 153.</p>
        </footer>
      </section>
    </main>
  );
}
