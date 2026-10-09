import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LogOut,
  MapPin,
  Phone,
  Clock,
  Radio,
  CheckCircle2,
  XCircle,
  Siren,
  RefreshCw,
  Printer,
  BellRing,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import type { Session } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";

type Oc = Tables<"ocorrencias">;

const TEMP_OPERATOR_EMAIL = "andersonf.g.marques@gmail.com";

export const Route = createFileRoute("/operador")({
  head: () => ({
    meta: [
      { title: "CAD – Central de Despacho | GCM Araçoiaba da Serra" },
      {
        name: "description",
        content: "Área do operador para receber e despachar ocorrências da GCM.",
      },
      { property: "og:title", content: "CAD – Central de Despacho GCM" },
      {
        property: "og:description",
        content: "Painel de despacho de ocorrências da Guarda Civil Municipal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Operador,
});

const STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-destructive/20 text-destructive" },
  despachada: { label: "Despachada", cls: "bg-primary/20 text-primary" },
  em_atendimento: { label: "Em atendimento", cls: "bg-accent/30 text-accent-foreground" },
  encerrada: { label: "Encerrada", cls: "bg-success/20 text-success" },
  cancelada: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
};
const VIATURAS = ["VTR-01", "VTR-02", "VTR-03", "MOTO-01", "MOTO-02", "Ambiental-01"];

function Operador() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready) return null;
  return session ? <Painel session={session} /> : <Login onLogin={setSession} />;
}

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      });

      if (error || !data.session) {
        const authMessage = error?.message?.toLowerCase() ?? "";
        if (authMessage.includes("email not confirmed")) {
          setMsg("Esta conta ainda não foi confirmada. Verifique o e-mail de confirmação ou confirme a conta no painel de autenticação do Supabase.");
        } else if (authMessage.includes("invalid login credentials")) {
          setMsg("O Supabase não reconheceu esta combinação de e-mail e senha. Confirme se a conta foi criada no mesmo projeto Supabase usado pelo site e se a senha atual está correta.");
        } else if (authMessage.includes("fetch") || authMessage.includes("network")) {
          setMsg("Não foi possível conectar ao serviço de autenticação. Verifique a URL do Supabase e a conexão do projeto.");
        } else {
          setMsg(error?.message ? `Falha na autenticação: ${error.message}` : "A autenticação não retornou uma sessão válida. Verifique a configuração do Supabase.");
        }
        return;
      }

      onLogin(data.session);
    } catch (err) {
      console.error("Falha no login do CAD:", err);
      setMsg("Não foi possível conectar ao serviço de autenticação. Verifique a configuração do Supabase e tente novamente.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={go}
        className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-xl"
      >
        <div className="flex items-center gap-3">
          <img
            src={`/aracoiaba-citizen-helper/android-chrome-192x192.png`}
            alt="Emblema da Guarda Civil Municipal"
            className="h-11 w-11 rounded-full object-cover"
          />
          <div>
            <h1 className="font-bold">CAD – GCM</h1>
            <p className="text-xs text-muted-foreground">Acesso restrito a operadores</p>
          </div>
        </div>

        <input
          type="email"
          required
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="password"
          required
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full rounded-xl border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />

        {msg && <p className="text-sm text-destructive">{msg}</p>}

        <button className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">
          Entrar
        </button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          ou
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={async () => {
            setMsg("");
            try {
              const redirect_uri = new URL("operador", window.location.href).toString();
              const result = await lovable.auth.signInWithOAuth("google", { redirect_uri });
              if (result.error) setMsg(result.error.message || "Não foi possível entrar com Google.");
            } catch (err) {
              console.error("Falha no login Google do CAD:", err);
              setMsg("Não foi possível iniciar o acesso com Google. Tente novamente.");
            }
          }}
          className="w-full rounded-xl border bg-secondary py-3 text-sm font-semibold"
        >
          Entrar com Google
        </button>

        <p className="text-center text-[11px] text-muted-foreground">
          Acesso restrito a operadores autorizados
        </p>

        <Link to="/" className="block text-center text-xs text-muted-foreground">
          ← Voltar ao atendimento
        </Link>
      </form>
    </div>
  );
}

function Painel({ session, demoOperator = false }: { session: Session | null; demoOperator?: boolean }) {
  const [ocs, setOcs] = useState<Oc[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingOcs, setLoadingOcs] = useState(true);
  const [autorizado, setAutorizado] = useState<boolean | null>(demoOperator ? true : null);
  const [filtro, setFiltro] = useState("ativas");
  const [sel, setSel] = useState<string | null>(null);
  const [novasPendentesIds, setNovasPendentesIds] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(false);
  // Mantém o contador de novas ocorrências definido a partir dos IDs recebidos.
  const novasPendentes = novasPendentesIds.length;

  const playAlert = () => {
    if (!soundEnabledRef.current || !audioContextRef.current) return;
    try {
      const context = audioContextRef.current;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.setValueAtTime(660, context.currentTime + 0.16);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.44);
    } catch (error) {
      console.warn("Não foi possível reproduzir o alerta sonoro do CAD:", error);
    }
  };

  const toggleSound = async () => {
    try {
      if (soundEnabledRef.current) {
        soundEnabledRef.current = false;
        setSoundEnabled(false);
        return;
      }
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) {
        window.alert("Este navegador não oferece suporte ao alerta sonoro do CAD.");
        return;
      }
      if (!audioContextRef.current) audioContextRef.current = new AudioContextConstructor();
      await audioContextRef.current.resume();
      soundEnabledRef.current = true;
      setSoundEnabled(true);
      playAlert();
    } catch {
      window.alert("Não foi possível ativar o som. Verifique as permissões de áudio do navegador.");
    }
  };

  const load = async () => {
    setLoadingOcs(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("ocorrencias")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) {
      setLoadError(error.message);
      setOcs([]);
    } else {
      setOcs(data ?? []);
    }
    setLoadingOcs(false);
  };

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const connect = async () => {
      if (!demoOperator) {
        if (!session) {
          setAutorizado(false);
          setConnectionStatus("disconnected");
          return;
        }
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);
        if (!active) return;
        const authorized = !error && !!data?.length;
        setAutorizado(authorized);
        if (!authorized) {
          setConnectionStatus("disconnected");
          return;
        }
      } else {
        setAutorizado(true);
      }

      await load();
      if (!active) return;

      channel = supabase
        .channel("ocorrencias-cad")
        .on("postgres_changes", { event: "*", schema: "public", table: "ocorrencias" }, (payload) => {
          if (payload.eventType === "INSERT") {
            const novaOcorrencia = payload.new as Oc;
            setOcs((current) => current.some((item) => item.id === novaOcorrencia.id)
              ? current
              : [novaOcorrencia, ...current]);
            if (novaOcorrencia.status === "pendente") {
              setNovasPendentesIds((ids) => ids.includes(novaOcorrencia.id)
                ? ids
                : [...ids, novaOcorrencia.id]);
              playAlert();
            }
          } else if (payload.eventType === "UPDATE") {
            const atualizada = payload.new as Oc;
            setOcs((current) => current.map((item) => item.id === atualizada.id ? atualizada : item));
            if (atualizada.status !== "pendente") {
              setNovasPendentesIds((ids) => ids.filter((pendingId) => pendingId !== atualizada.id));
            }
          } else if (payload.eventType === "DELETE") {
            const removida = payload.old as Partial<Oc>;
            if (removida.id) {
              setOcs((current) => current.filter((item) => item.id !== removida.id));
              setNovasPendentesIds((ids) => ids.filter((pendingId) => pendingId !== removida.id));
            }
          }
        })
        .subscribe((status) => {
          if (!active) return;
          if (status === "SUBSCRIBED") {
            setConnectionStatus("connected");
            // Reconcilia a lista após conectar ou reconectar para recuperar eventos perdidos.
            void load();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setConnectionStatus("disconnected");
          } else {
            setConnectionStatus("connecting");
          }
        });
    };

    void connect();
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [session?.user.id, demoOperator, connectionAttempt]);

  const lista = useMemo(() => {
    const filtered = ocs.filter((o) =>
      filtro === "ativas"
        ? !["encerrada", "cancelada"].includes(o.status)
        : filtro === "todas"
          ? true
          : o.status === filtro,
    );
    return filtered.sort((a, b) => {
      const pendingDifference = Number(b.status === "pendente") - Number(a.status === "pendente");
      if (pendingDifference !== 0) return pendingDifference;
      const priorityScore = (o: Oc) => ["alta", "urgente"].includes(o.prioridade.toLowerCase()) ? 1 : 0;
      const priorityDifference = priorityScore(b) - priorityScore(a);
      if (priorityDifference !== 0) return priorityDifference;
      if (a.status === "pendente" && b.status === "pendente") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [ocs, filtro]);
  const atual = ocs.find((o) => o.id === sel) ?? null;
  const cont = (s: string) => ocs.filter((o) => o.status === s).length;

  const update = async (id: string, patch: Partial<Oc>, acaoPersonalizada?: string): Promise<boolean> => {
    const anterior = ocs.find((item) => item.id === id);
    if (!anterior || savingIds.includes(id)) return false;
    setSavingIds((ids) => ids.includes(id) ? ids : [...ids, id]);
    try {
      // Compare-and-set: só altera se o status ainda for o que este operador visualizou.
      // Isso impede dois operadores de despacharem a mesma ocorrência simultaneamente.
      const { data, error } = await supabase
        .from("ocorrencias")
        .update(patch)
        .eq("id", id)
        .eq("status", anterior.status)
        .select("*")
        .maybeSingle();
      if (error || !data) {
        await load();
        window.alert(error
          ? `Não foi possível salvar a alteração: ${error.message}`
          : "Esta ocorrência foi alterada por outro operador. A lista foi atualizada; confira o status antes de tentar novamente.");
        return false;
      }

      setOcs((items) => items.map((item) => item.id === id ? data : item));
      if (anterior.status === "pendente" && data.status !== "pendente") {
        setNovasPendentesIds((ids) => ids.filter((pendingId) => pendingId !== id));
      }
      const acao = acaoPersonalizada ?? (patch.status === "despachada" ? "Despacho realizado"
        : patch.status === "em_atendimento" ? "Início do atendimento"
        : patch.status === "encerrada" ? "Ocorrência encerrada"
        : patch.status === "cancelada" ? "Ocorrência cancelada"
        : "Dados da ocorrência atualizados");
      const { error: historicoError } = await supabase.from("ocorrencia_historico").insert({
        ocorrencia_id: id,
        operador_id: session!.user.id,
        acao,
        status_anterior: anterior.status,
        status_novo: data.status,
        viatura: data.viatura,
        observacao: data.observacao,
      });
      if (historicoError) {
        window.alert(`A ocorrência foi atualizada, mas o histórico não foi salvo: ${historicoError.message}`);
      } else {
        window.alert(`${acao} registrado com sucesso.`);
      }
      return true;
    } finally {
      setSavingIds((ids) => ids.filter((savingId) => savingId !== id));
    }
  };

  const sair = async () => {
    if (session) await supabase.auth.signOut();
    window.location.reload();
  };

  if (autorizado === false)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p>Sua conta ainda não foi liberada como operador. Peça ao administrador da central.</p>
        <button
          onClick={sair}
          className="rounded-xl bg-secondary px-4 py-2 text-sm"
        >
          Sair
        </button>
      </div>
    );

  return (
    <div className="flex h-screen flex-col">
      <header className="bg-header flex items-center gap-3 border-b px-5 py-3">
        <img
          src={`/aracoiaba-citizen-helper/android-chrome-192x192.png`}
          alt="Emblema da Guarda Civil Municipal"
          className="h-8 w-8 rounded-full object-cover"
        />
        <h1 className="font-bold">CAD · Central de Despacho GCM</h1>
        <span className={`ml-2 flex items-center gap-1.5 text-xs ${connectionStatus === "connected" ? "text-success" : connectionStatus === "connecting" ? "text-primary" : "text-destructive"}`} role="status" aria-live="polite">
          {connectionStatus === "connected" ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {connectionStatus === "connected" ? "Ao vivo" : connectionStatus === "connecting" ? "Conectando…" : "Sem conexão em tempo real"}
        </span>
        {connectionStatus === "disconnected" && (
          <button
            type="button"
            onClick={() => {
              setConnectionStatus("connecting");
              setConnectionAttempt((attempt) => attempt + 1);
            }}
            className="rounded-lg border border-destructive/40 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
            title="Reconectar ao canal em tempo real e sincronizar ocorrências"
          >
            Reconectar
          </button>
        )}
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <button
            onClick={load}
            disabled={loadingOcs}
            className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 font-semibold text-foreground disabled:opacity-50"
            title="Atualizar ocorrências"
          >
            <RefreshCw className={`h-4 w-4 ${loadingOcs ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <button
            onClick={toggleSound}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold ${soundEnabled ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
            title={soundEnabled ? "Desativar alertas sonoros" : "Ativar alertas sonoros para novas ocorrências"}
            aria-pressed={soundEnabled}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {soundEnabled ? "Som ativado" : "Ativar som"}
          </button>
          <span title={`Operador autenticado: ${session?.user.id ?? "demonstração"}`}>{session?.user.email ?? TEMP_OPERATOR_EMAIL}</span>
          <button
            onClick={sair}
            aria-label="Sair"
            className="rounded-full p-2 hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 border-b p-4 md:grid-cols-4">
        {[
          ["pendente", Siren],
          ["despachada", Radio],
          ["em_atendimento", Clock],
          ["encerrada", CheckCircle2],
        ].map(([s, Icon]) => {
          const I = Icon as typeof Siren;
          return (
            <div key={s as string} className="flex items-center gap-3 rounded-xl bg-card p-3">
              <I className="h-5 w-5 text-primary" />
              <div>
                <p className="font-display text-2xl font-bold">{cont(s as string)}</p>
                <p className="text-xs text-muted-foreground">{STATUS[s as string]!.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-full flex-col border-r md:w-[420px]">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
            {["ativas", "pendente", "despachada", "em_atendimento", "encerrada", "cancelada", "todas"].map(
              (f) => (
                <button
                  key={f}
                  onClick={() => {
                    setFiltro(f);
                    if (f === "pendente") setNovasPendentesIds([]);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${filtro === f ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"}`}
                >
                  {f === "pendente" && novasPendentes > 0 && (
                    <BellRing className="h-3.5 w-3.5 animate-pulse text-amber-400" aria-label="Novas ocorrências pendentes" />
                  )}
                  {f === "ativas" ? "Ativas" : f === "todas" ? "Todas" : STATUS[f]!.label}
                  {f === "pendente" && novasPendentesIds.length > 0 && (
                    <span className="ml-0.5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] leading-none text-destructive-foreground">
                      {novasPendentesIds.length > 99 ? "99+" : novasPendentesIds.length}
                    </span>
                  )}
                </button>
              ),
            )}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
            {loadError && (
              <div className="m-2 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-xs">
                <p className="font-bold text-destructive">Falha ao carregar ocorrências</p>
                <p className="mt-1 break-words text-muted-foreground">{loadError}</p>
                <button onClick={load} className="mt-2 rounded-lg bg-secondary px-3 py-1.5 font-semibold">Tentar novamente</button>
              </div>
            )}
            {loadingOcs && !loadError && (
              <p className="p-6 text-center text-sm text-muted-foreground">Carregando ocorrências...</p>
            )}
            {!loadingOcs && !loadError && lista.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma ocorrência registrada no banco de dados.</p>
            )}
            {lista.map((o) => {
              const prioridadeUrgente = ["alta", "urgente"].includes(o.prioridade.toLowerCase());
              const minutosAguardando = Math.floor(Math.max(0, Date.now() - new Date(o.created_at).getTime()) / 60000);
              const pendenciaProlongada = o.status === "pendente" && minutosAguardando >= 10;
              const pendenciaCritica = o.status === "pendente" && minutosAguardando >= 20;
              const destaque = prioridadeUrgente || pendenciaCritica;
              return (
                <button
                  key={o.id}
                  onClick={() => setSel(o.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${sel === o.id ? "border-primary bg-secondary" : "bg-card hover:bg-secondary"} ${o.status === "pendente" ? pendenciaCritica ? "border-l-4 border-l-destructive bg-destructive/10" : pendenciaProlongada ? "border-l-4 border-l-amber-400" : "border-l-4 border-l-primary" : ""} ${destaque ? "ring-1 ring-destructive/60" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">{o.categoria}</span>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {prioridadeUrgente && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">URGENTE</span>}
                      {pendenciaCritica && <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">AGUARDANDO 20+ MIN</span>}
                      {!pendenciaCritica && pendenciaProlongada && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">AGUARDANDO 10+ MIN</span>}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS[o.status]?.cls}`}
                      >
                        {STATUS[o.status]?.label}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {o.endereco}
                  </p>
                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>{o.protocolo}</span>
                    <span className="text-right">
                      {new Date(o.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {o.status === "pendente" && (
                        <span className={`mt-1 block font-semibold ${pendenciaCritica ? "text-destructive" : pendenciaProlongada ? "text-amber-300" : "text-muted-foreground"}`}>
                          {minutosAguardando < 60
                            ? `${minutosAguardando} min aguardando`
                            : `${Math.floor(minutosAguardando / 60)} h ${minutosAguardando % 60} min aguardando`}
                        </span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="hidden flex-1 overflow-y-auto p-6 md:block">
          {!atual ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Selecione uma ocorrência para despachar.
            </div>
          ) : (
            <Detalhe key={atual.id} o={atual} update={update} saving={savingIds.includes(atual.id)} session={session} />
          )}
        </section>
      </div>
      {atual && (
        <div className="fixed inset-0 z-10 overflow-y-auto bg-background p-4 md:hidden">
          <button onClick={() => setSel(null)} className="mb-3 text-sm text-primary">
            ← Voltar
          </button>
          <Detalhe key={atual.id} o={atual} update={update} saving={savingIds.includes(atual.id)} session={session} />
        </div>
      )}
    </div>
  );
}

type HistoricoOcorrencia = {
  id: string;
  acao: string;
  status_anterior: string | null;
  status_novo: string | null;
  viatura: string | null;
  observacao: string | null;
  criado_em: string;
  operador_id: string;
};

function Detalhe({ o, update, saving, session }: {
  o: Oc;
  update: (id: string, p: Partial<Oc>, acaoPersonalizada?: string) => Promise<boolean>;
  saving: boolean;
  session: Session | null;
}) {
  const [historico, setHistorico] = useState<HistoricoOcorrencia[]>([]);
  const [historicoErro, setHistoricoErro] = useState<string | null>(null);
  const [historicoCarregando, setHistoricoCarregando] = useState(true);
  const [historicoRevision, setHistoricoRevision] = useState(0);

  useEffect(() => {
    let ativo = true;
    setHistoricoCarregando(true);
    setHistoricoErro(null);

    const carregarHistorico = async () => {
      const { data, error } = await supabase
        .from("ocorrencia_historico")
        .select("*")
        .eq("ocorrencia_id", o.id)
        .order("criado_em", { ascending: true });

      if (!ativo) return;
      if (error) {
        setHistoricoErro(error.message);
      } else {
        setHistorico(
          ((data ?? []) as HistoricoOcorrencia[]).sort(
            (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime(),
          ),
        );
      }
      setHistoricoCarregando(false);
    };

    void carregarHistorico();
    return () => { ativo = false; };
  }, [o.id, o.updated_at, historicoRevision]);

  const despachoRegistrado = historico.find((item) => item.status_novo === "em_atendimento" || item.acao.toLowerCase().includes("despacho"));
  const encerramentoRegistrado = [...historico].reverse().find((item) => item.status_novo === "encerrada");
  const identificacaoOperador = (operadorId: string) =>
    operadorId === session?.user.id ? (session?.user.email ?? operadorId) : operadorId;
  const termoAceite = o.descricao.match(/\n\n\[REGISTRO_TERMO_ART340: ACEITO_EM=(.+)\]/);
  const descricaoLimpa = o.descricao.replace(/\n\n\[REGISTRO_TERMO_ART340: ACEITO_EM=.+\]/, "");
  const [vtr, setVtr] = useState(o.viatura ?? "");
  // O campo é para a próxima ação, não para reapresentar a observação já gravada na ocorrência.
  // Assim, ao reabrir ou selecionar novamente uma ocorrência, não repete o texto do despacho anterior.
  const [obs, setObs] = useState("");

  const imprimirRelatorio = () => {
    const escapeHtml = (value: unknown) =>
      String(value ?? "—").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      })[char]!);
    const dataHora = (value: string) => new Date(value).toLocaleString("pt-BR");
    const historicoHtml = historico.length
      ? historico.map((h) => `
          <article class="movimento">
            <strong>${escapeHtml(h.acao)}</strong>
            <div>${escapeHtml(dataHora(h.criado_em))} · ${escapeHtml(h.status_anterior ?? "novo")} → ${escapeHtml(h.status_novo ?? "—")}</div>
            <div>Operador: ${escapeHtml(identificacaoOperador(h.operador_id))}</div>
            ${h.viatura ? `<div>Viatura: ${escapeHtml(h.viatura)}</div>` : ""}
            ${h.observacao ? `<p>${escapeHtml(h.observacao)}</p>` : ""}
          </article>`).join("")
      : "<p>Não há movimentações registradas.</p>";
    const termoHtml = termoAceite
      ? `Aceito em ${escapeHtml(dataHora(termoAceite[1]!))}`
      : "Sem registro de aceite";
    const relatorio = window.open("", "_blank", "width=900,height=700");
    if (!relatorio) {
      window.alert("O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente novamente.");
      return;
    }
    relatorio.onload = () => relatorio.print();
    relatorio.document.write(`<!doctype html>
      <html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório ${escapeHtml(o.protocolo)}</title>
      <style>
        @page { size: A4; margin: 18mm; }
        body { font: 12px Arial, sans-serif; color: #111; line-height: 1.45; }
        header { border-bottom: 2px solid #111; margin-bottom: 18px; padding-bottom: 12px; }
        h1 { font-size: 18px; margin: 0 0 4px; } h2 { font-size: 14px; margin: 18px 0 8px; }
        .muted { color: #444; } .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; }
        .field { margin: 5px 0; } .label { font-weight: bold; }
        .description { white-space: pre-wrap; border: 1px solid #bbb; padding: 10px; min-height: 45px; }
        .movimento { border-left: 2px solid #555; padding: 2px 0 7px 10px; margin: 8px 0; }
        .movimento div { color: #444; font-size: 11px; } .signature { margin-top: 42px; border-top: 1px solid #777; width: 60%; padding-top: 5px; }
        .actions { margin-bottom: 16px; } button { padding: 8px 14px; }
        @media print { .actions { display: none; } }
      </style></head><body>
      <div class="actions"><button onclick="window.print()">Imprimir / Salvar em PDF</button></div>
      <header><h1>Guarda Civil Municipal de Araçoiaba da Serra</h1><div>CAD · Central de Despacho — Relatório de ocorrência</div></header>
      <div class="grid">
        <div class="field"><span class="label">Protocolo:</span> ${escapeHtml(o.protocolo)}</div>
        <div class="field"><span class="label">Status:</span> ${escapeHtml(STATUS[o.status]?.label ?? o.status)}</div>
        <div class="field"><span class="label">Natureza/Categoria:</span> ${escapeHtml(o.categoria)}</div>
        <div class="field"><span class="label">Prioridade:</span> ${escapeHtml(o.prioridade)}</div>
        <div class="field"><span class="label">Data de registro:</span> ${escapeHtml(dataHora(o.created_at))}</div>
        <div class="field"><span class="label">Viatura:</span> ${escapeHtml(o.viatura)}</div>
      </div>
      <h2>Dados do solicitante</h2>
      <div class="field"><span class="label">Nome:</span> ${escapeHtml(o.nome)}</div>
      <div class="field"><span class="label">CPF:</span> ${escapeHtml(o.cpf)}</div>
      <div class="field"><span class="label">Telefone:</span> ${escapeHtml(o.telefone)}</div>
      <div class="field"><span class="label">Endereço do solicitante:</span> ${escapeHtml(o.endereco_solicitante)}</div>
      <h2>Local da ocorrência</h2><div>${escapeHtml(o.endereco)}</div>
      <h2>Descrição da ocorrência</h2><div class="description">${escapeHtml(descricaoLimpa)}</div>
      <h2>Termo de ciência do art. 340</h2><div>${termoHtml}</div>
      <h2>Observações operacionais</h2><div class="description">${escapeHtml(o.observacao)}</div>
      <h2>Histórico operacional</h2>${historicoHtml}
      <div class="signature">Responsável pelo registro / despacho</div>
      <p class="muted" style="margin-top:22px;font-size:10px">Documento gerado pelo CAD. Contém dados pessoais e deve ser manuseado conforme as normas aplicáveis de proteção de dados.</p>
      </body></html>`);
    relatorio.document.close();
    relatorio.focus();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {o.protocolo} · {new Date(o.created_at).toLocaleString("pt-BR")}
          </p>
          <h2 className="text-2xl font-bold">{o.categoria}</h2>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase ${STATUS[o.status]?.cls}`}
        >
          {STATUS[o.status]?.label}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-primary/30 bg-card p-3">
          <p className="text-xs text-muted-foreground">Despacho / início do atendimento</p>
          <p className="mt-1 text-sm font-semibold">{despachoRegistrado ? new Date(despachoRegistrado.criado_em).toLocaleString("pt-BR") : "Ainda não registrado"}</p>
          {despachoRegistrado && <p className="mt-1 break-all text-xs text-muted-foreground">Operador: {identificacaoOperador(despachoRegistrado.operador_id)}</p>}
        </div>
        <div className="rounded-xl border border-success/30 bg-card p-3">
          <p className="text-xs text-muted-foreground">Encerramento</p>
          <p className="mt-1 text-sm font-semibold">{encerramentoRegistrado ? new Date(encerramentoRegistrado.criado_em).toLocaleString("pt-BR") : "Ainda não encerrada"}</p>
          {encerramentoRegistrado && <p className="mt-1 break-all text-xs text-muted-foreground">Operador: {identificacaoOperador(encerramentoRegistrado.operador_id)}</p>}
        </div>
      </div>
      <button
        onClick={imprimirRelatorio}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm"
        title="Imprimir ou salvar relatório em PDF"
        type="button"
      >
        <Printer className="h-4 w-4" /> Imprimir ocorrência / Salvar em PDF
      </button>
      <div className="space-y-3 rounded-2xl bg-card p-5">
        <div className="rounded-xl border border-success/40 bg-success/10 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" /> Termo de ciência do art. 340: {termoAceite ? "ACEITO" : "SEM REGISTRO DE ACEITE"}
          </div>
          {termoAceite && <p className="mt-1 text-xs text-muted-foreground">Aceite registrado em {new Date(termoAceite[1]!).toLocaleString("pt-BR")}</p>}
        </div>
        <p className="leading-relaxed">{descricaoLimpa}</p>
        <a
          href={`https://www.google.com/maps/search/${encodeURIComponent(o.endereco + ", Araçoiaba da Serra - SP")}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-sm text-primary"
        >
          <MapPin className="h-4 w-4" /> {o.endereco}
        </a>
        <a href={`tel:${o.telefone}`} className="flex items-center gap-2 text-sm">
          <Phone className="h-4 w-4" /> {o.nome} · {o.telefone}
        </a>
        <p className="text-sm text-muted-foreground">
          CPF: {o.cpf ? o.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "—"}
        </p>
        <p className="text-sm text-muted-foreground">
          Residência do solicitante: {o.endereco_solicitante ?? "—"}
        </p>
      </div>
      <div className="space-y-3 rounded-2xl bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Histórico operacional</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{historico.length} registro(s)</span>
            <button
              type="button"
              onClick={() => setHistoricoRevision((revision) => revision + 1)}
              className="rounded-lg bg-secondary px-2 py-1 text-xs font-semibold text-foreground"
              title="Recarregar histórico operacional"
            >
              <RefreshCw className="mr-1 inline h-3 w-3" /> Atualizar
            </button>
          </div>
        </div>
        {historicoCarregando && <p className="text-xs text-muted-foreground">Carregando movimentações…</p>}
        {historicoErro && <p className="text-xs text-destructive">Não foi possível carregar o histórico: {historicoErro}</p>}
        {!historicoCarregando && !historicoErro && historico.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma movimentação encontrada no banco para esta ocorrência. Atualize para consultar novamente.</p>}
        {historico.map((h) => (
          <div key={h.id} className="border-l-2 border-primary/50 pl-3 py-1">
            <p className="text-sm font-semibold">{h.acao}</p>
            <p className="text-xs text-muted-foreground">{new Date(h.criado_em).toLocaleString("pt-BR")} · {h.status_anterior ?? "novo"} → {h.status_novo ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Operador: {identificacaoOperador(h.operador_id)}</p>
            {h.viatura && <p className="text-xs text-muted-foreground">Viatura: {h.viatura}</p>}
            {h.observacao && <p className="mt-1 text-xs">{h.observacao}</p>}
          </div>
        ))}
      </div>
      <div className="space-y-3 rounded-2xl bg-card p-5">
        <p className="text-sm font-semibold">Viatura</p>
        <div className="flex flex-wrap gap-2">
          {VIATURAS.map((v) => (
            <button
              key={v}
              onClick={() => setVtr(v)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${vtr === v ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">
            {o.status === "em_atendimento" ? "Desfecho do atendimento / providências adotadas" : "Equipe responsável / informações do despacho"}
          </span>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder={o.status === "em_atendimento" ? "Descreva o que a equipe constatou, as providências tomadas e o resultado..." : "Informe a equipe que será empenhada e as orientações para atendimento..."}
            rows={3}
            className="w-full rounded-xl border bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {o.status !== "em_atendimento" && o.status !== "encerrada" && o.status !== "cancelada" && (
            <button
              disabled={saving || !vtr || !obs.trim()}
              onClick={async () => {
                const sucesso = await update(
                  o.id,
                  { status: "em_atendimento", viatura: vtr, observacao: obs.trim() },
                  "Despacho realizado — equipe acionada e atendimento iniciado",
                );
                if (sucesso) {
                  setObs("");
                  setHistoricoRevision((revision) => revision + 1);
                }
              }}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
              title="Registra a equipe e inicia o atendimento"
            >
              <Radio className="h-4 w-4" /> {saving ? "Registrando…" : "Despachar"}
            </button>
          )}
          {o.status === "em_atendimento" && (
            <button
              disabled={saving || !obs.trim()}
              onClick={async () => {
                const sucesso = await update(o.id, { status: "encerrada", observacao: obs.trim() }, "Atendimento encerrado — desfecho registrado");
                if (sucesso) {
                  setObs("");
                  setHistoricoRevision((revision) => revision + 1);
                }
              }}
              className="flex items-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              title="Salva o desfecho informado e encerra a ocorrência"
            >
              <CheckCircle2 className="h-4 w-4" /> Registrar desfecho e encerrar
            </button>
          )}
          <button
            disabled={saving}
            onClick={async () => {
              const sucesso = await update(o.id, { status: "cancelada", observacao: obs.trim() || o.observacao }, "Ocorrência cancelada");
              if (sucesso) {
                setObs("");
                setHistoricoRevision((revision) => revision + 1);
              }
            }}
            className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm"
          >
            <XCircle className="h-4 w-4" /> Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
