import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Shield,
  LogOut,
  MapPin,
  Phone,
  Clock,
  Radio,
  CheckCircle2,
  XCircle,
  Siren,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";

type Oc = Tables<"ocorrencias">;

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
  return session ? <Painel session={session} /> : <Login />;
}

function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [msg, setMsg] = useState("");
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    const { data, error } =
      modo === "entrar"
        ? await supabase.auth.signInWithPassword({ email, password: senha })
        : await supabase.auth.signUp({
            email,
            password: senha,
            options: { emailRedirectTo: new URL("operador", window.location.href).toString() },
          });
    if (error) setMsg(error.message);
    else if (modo === "criar" && !data.session)
      setMsg("Conta criada. Confirme pelo link enviado ao seu e-mail.");
  };
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={go}
        className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-xl"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Shield className="h-6 w-6" />
          </div>
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
          minLength={6}
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full rounded-xl border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        <button className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">
          {modo === "entrar" ? "Entrar" : "Criar conta"}
        </button>
        <button
          type="button"
          onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
          className="w-full text-xs text-muted-foreground underline"
        >
          {modo === "entrar" ? "Criar conta de operador" : "Já tenho conta"}
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
            const redirectTo = new URL("operador", window.location.href).toString();
            const { error } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: {
                redirectTo,
              },
            });
            if (error) setMsg(error.message ?? "Erro ao entrar com Google");
          }}
          className="w-full rounded-xl border bg-secondary py-3 text-sm font-semibold"
        >
          Entrar com Google
        </button>
        <Link to="/" className="block text-center text-xs text-muted-foreground">
          ← Voltar ao atendimento
        </Link>
      </form>
    </div>
  );
}

function Painel({ session }: { session: Session }) {
  const [ocs, setOcs] = useState<Oc[]>([]);
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [filtro, setFiltro] = useState("ativas");
  const [sel, setSel] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("ocorrencias")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    setOcs(data ?? []);
  };

  useEffect(() => {
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .then(({ data }) => {
        const ok = !!data?.length;
        setAutorizado(ok);
        if (ok) load();
      });
    const ch = supabase
      .channel("ocorrencias-cad")
      .on("postgres_changes", { event: "*", schema: "public", table: "ocorrencias" }, (p) => {
        if (p.eventType === "INSERT") {
          setOcs((o) => [p.new as Oc, ...o]);
          try {
            new Audio(
              "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
            ).play();
          } catch {
            /* Ignore autoplay errors. */
          }
        } else if (p.eventType === "UPDATE")
          setOcs((o) => o.map((x) => (x.id === (p.new as Oc).id ? (p.new as Oc) : x)));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [session.user.id]);

  const lista = useMemo(
    () =>
      ocs.filter((o) =>
        filtro === "ativas"
          ? !["encerrada", "cancelada"].includes(o.status)
          : filtro === "todas"
            ? true
            : o.status === filtro,
      ),
    [ocs, filtro],
  );
  const atual = ocs.find((o) => o.id === sel) ?? null;
  const cont = (s: string) => ocs.filter((o) => o.status === s).length;

  const update = async (id: string, patch: Partial<Oc>) => {
    setOcs((o) => o.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await supabase.from("ocorrencias").update(patch).eq("id", id);
  };

  if (autorizado === false)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p>Sua conta ainda não foi liberada como operador. Peça ao administrador da central.</p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded-xl bg-secondary px-4 py-2 text-sm"
        >
          Sair
        </button>
      </div>
    );

  return (
    <div className="flex h-screen flex-col">
      <header className="bg-header flex items-center gap-3 border-b px-5 py-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="font-bold">CAD · Central de Despacho GCM</h1>
        <span className="ml-2 flex items-center gap-1.5 text-xs text-success">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> Ao vivo
        </span>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {session.user.email}
          <button
            onClick={() => supabase.auth.signOut()}
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
          <div className="flex gap-1 overflow-x-auto p-3">
            {["ativas", "pendente", "despachada", "em_atendimento", "encerrada", "todas"].map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${filtro === f ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                >
                  {f === "ativas" ? "Ativas" : f === "todas" ? "Todas" : STATUS[f]!.label}
                </button>
              ),
            )}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
            {lista.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma ocorrência.</p>
            )}
            {lista.map((o) => (
              <button
                key={o.id}
                onClick={() => setSel(o.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${sel === o.id ? "border-primary bg-secondary" : "bg-card hover:bg-secondary"} ${o.status === "pendente" ? "border-l-4 border-l-destructive" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{o.categoria}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS[o.status]?.cls}`}
                  >
                    {STATUS[o.status]?.label}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {o.endereco}
                </p>
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>{o.protocolo}</span>
                  <span>
                    {new Date(o.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {o.prioridade === "alta" && <b className="ml-2 text-destructive">ALTA</b>}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="hidden flex-1 overflow-y-auto p-6 md:block">
          {!atual ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Selecione uma ocorrência para despachar.
            </div>
          ) : (
            <Detalhe key={atual.id} o={atual} update={update} />
          )}
        </section>
      </div>
      {atual && (
        <div className="fixed inset-0 z-10 overflow-y-auto bg-background p-4 md:hidden">
          <button onClick={() => setSel(null)} className="mb-3 text-sm text-primary">
            ← Voltar
          </button>
          <Detalhe key={atual.id} o={atual} update={update} />
        </div>
      )}
    </div>
  );
}

function Detalhe({ o, update }: { o: Oc; update: (id: string, p: Partial<Oc>) => void }) {
  const [vtr, setVtr] = useState(o.viatura ?? "");
  const [obs, setObs] = useState(o.observacao ?? "");
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            {o.protocolo} · {new Date(o.created_at).toLocaleString("pt-BR")}
          </p>
          <h2 className="text-2xl font-bold">{o.categoria}</h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${STATUS[o.status]?.cls}`}
        >
          {STATUS[o.status]?.label}
        </span>
      </div>
      <div className="space-y-3 rounded-2xl bg-card p-5">
        <p className="leading-relaxed">{o.descricao}</p>
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
        <textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Observações do operador"
          rows={3}
          className="w-full rounded-xl border bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex flex-wrap gap-2">
          <button
            disabled={!vtr}
            onClick={() => update(o.id, { status: "despachada", viatura: vtr, observacao: obs })}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            <Radio className="h-4 w-4" /> Despachar
          </button>
          <button
            onClick={() => update(o.id, { status: "em_atendimento", observacao: obs })}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
          >
            Em atendimento
          </button>
          <button
            onClick={() => update(o.id, { status: "encerrada", observacao: obs })}
            className="flex items-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <CheckCircle2 className="h-4 w-4" /> Encerrar
          </button>
          <button
            onClick={() => update(o.id, { status: "cancelada", observacao: obs })}
            className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm"
          >
            <XCircle className="h-4 w-4" /> Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
