import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, ShieldCheck, Users, ClipboardList, History, RefreshCw,
  LogOut, CheckCircle2, Ban, Trash2, AlertTriangle, LockKeyhole, Eye, FileDown, X,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import type { Json } from "@/integrations/supabase/types";

const ADMIN_EMAIL = "andersonf.g.marques@gmail.com";
type AdminTab = "usuarios" | "ocorrencias" | "auditoria";
type AdminUser = {
  user_id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  role: string;
  nome_completo?: string | null;
  matricula?: string | null;
  cargo?: string | null;
  lotacao?: string | null;
};
type AdminOccurrence = {
  id: string;
  protocolo: string;
  categoria: string;
  status: string;
  created_at: string;
  viatura: string | null;
};
type OccurrenceDetails = AdminOccurrence & {
  prioridade: string;
  nome: string;
  telefone: string;
  cpf: string | null;
  endereco: string;
  endereco_solicitante: string | null;
  descricao: string;
  observacao: string | null;
  updated_at: string;
};
type OccurrenceHistory = {
  id: string;
  ocorrencia_id: string;
  operador_id: string;
  acao: string;
  status_anterior: string | null;
  status_novo: string | null;
  viatura: string | null;
  observacao: string | null;
  criado_em: string;
};
type AuditEntry = {
  id: string;
  actor_email: string;
  action: string;
  target_user_id: string | null;
  occurrence_id: string | null;
  details: Json;
  created_at: string;
};

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração CAD | GCM Araçoiaba da Serra" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("pt-BR") : "Nunca";
}

const AUDIT_ACTIONS: Record<string, { title: string; category: string; tone: string }> = {
  operator_access_granted: { title: "Acesso de operador liberado", category: "Acesso", tone: "success" },
  operator_access_revoked: { title: "Acesso de operador revogado", category: "Acesso", tone: "warning" },
  user_account_deletion_requested: { title: "Solicitação de exclusão de conta", category: "Conta", tone: "warning" },
  user_account_deleted: { title: "Conta de usuário excluída", category: "Conta", tone: "danger" },
  occurrence_deleted: { title: "Ocorrência excluída", category: "Ocorrência", tone: "danger" },
};

const AUDIT_DETAIL_LABELS: Record<string, string> = {
  enabled: "Acesso operacional",
  target_email: "Conta afetada",
  reason: "Justificativa",
  requested_at: "Data da solicitação",
  occurrence_protocol: "Protocolo",
  protocol: "Protocolo",
  status: "Status",
  viatura: "Viatura",
};

function getAuditAction(action: string) {
  return AUDIT_ACTIONS[action] ?? {
    title: action.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()),
    category: "Sistema",
    tone: "neutral",
  };
}

function formatAuditValue(key: string, value: unknown) {
  if (key === "enabled") return value === true ? "Liberado" : value === false ? "Revogado" : String(value);
  if (key === "requested_at" && typeof value === "string") return formatDate(value);
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function auditDetails(details: Json) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  return Object.entries(details as Record<string, unknown>).map(([key, value]) => ({
    key,
    label: AUDIT_DETAIL_LABELS[key] ?? key.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()),
    value: formatAuditValue(key, value),
  }));
}

function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<AdminTab>("usuarios");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [occurrences, setOccurrences] = useState<AdminOccurrence[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [selectedOccurrence, setSelectedOccurrence] = useState<AdminOccurrence | null>(null);
  const [viewingOccurrence, setViewingOccurrence] = useState<OccurrenceDetails | null>(null);
  const [occurrenceHistory, setOccurrenceHistory] = useState<OccurrenceHistory[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [selectedUserDeletion, setSelectedUserDeletion] = useState<AdminUser | null>(null);
  const [userDeleteReason, setUserDeleteReason] = useState("");

  useEffect(() => {
    const { data } = adminSupabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionReady(true);
    });
    void adminSupabase.auth.getSession().then(({ data: authData }) => {
      setSession(authData.session);
      setSessionReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    setChecking(true);
    setLoading(true);
    setError("");
    setMessage("");
    setAllowed(false);

    const { data: userData, error: userError } = await adminSupabase.rpc("admin_list_users");
    if (userError) {
      setError(
        userError.message.includes("does not exist") || userError.message.includes("schema cache")
          ? "O banco ainda não recebeu a migração do painel administrativo. O acesso permanece bloqueado até a configuração segura do Supabase."
          : userError.message,
      );
      setChecking(false);
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await adminSupabase.rpc("admin_list_operator_profiles");
    const profiles = new Map((profileData ?? []).map((profile) => [profile.user_id, profile]));
    setUsers(((userData ?? []) as AdminUser[]).map((user) => ({
      ...user,
      nome_completo: profiles.get(user.user_id)?.nome_completo ?? null,
      matricula: profiles.get(user.user_id)?.matricula ?? null,
      cargo: profiles.get(user.user_id)?.cargo ?? null,
      lotacao: profiles.get(user.user_id)?.lotacao ?? null,
    })));
    setAllowed(true);
    if (profileError && !profileError.message.includes("does not exist") && !profileError.message.includes("schema cache")) {
      setError("Não foi possível carregar os perfis funcionais: " + profileError.message);
    }
    const [occurrenceResult, auditResult] = await Promise.all([
      adminSupabase.rpc("admin_list_occurrences"),
      adminSupabase.rpc("admin_list_audit", { _limit: 100 }),
    ]);
    if (occurrenceResult.error) setError("Usuários carregados, mas não foi possível consultar ocorrências: " + occurrenceResult.error.message);
    else setOccurrences((occurrenceResult.data ?? []) as AdminOccurrence[]);
    if (auditResult.error) setError((current) => current ? current + " | Auditoria: " + auditResult.error!.message : "Não foi possível carregar a auditoria: " + auditResult.error!.message);
    else setAudit((auditResult.data ?? []) as AuditEntry[]);
    setChecking(false);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (session) void load();
    else {
      setAllowed(false);
      setUsers([]);
      setOccurrences([]);
      setAudit([]);
    }
  }, [session, load]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError("");
    const { data, error: loginError } = await adminSupabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (loginError || !data.session) {
      setAuthError(loginError?.message ?? "Não foi possível iniciar a sessão.");
      return;
    }
    if (data.session.user.email?.toLowerCase() !== ADMIN_EMAIL) {
      await adminSupabase.auth.signOut();
      setAuthError("Esta área é exclusiva da conta administrativa autorizada.");
    }
  };

  const signOut = async () => {
    await adminSupabase.auth.signOut();
    setSession(null);
    setAllowed(false);
  };

  const setOperatorAccess = async (user: AdminUser, enabled: boolean) => {
    if (user.role === "admin") return;
    if (!enabled && !window.confirm(`Bloquear o acesso ao CAD de ${user.email ?? user.user_id}?`)) return;
    setBusyId(user.user_id);
    setError("");
    setMessage("");
    const { error: operationError } = await adminSupabase.rpc("admin_set_operator_access", {
      _user_id: user.user_id,
      _enabled: enabled,
    });
    setBusyId("");
    if (operationError) {
      setError(operationError.message);
      return;
    }
    setMessage(enabled ? "Acesso de operador liberado." : "Acesso operacional revogado.");
    await load();
  };

  const deleteUserAccount = async () => {
    if (!selectedUserDeletion || userDeleteReason.trim().length < 5) {
      setError("Informe o motivo da exclusão com pelo menos 5 caracteres.");
      return;
    }
    const target = selectedUserDeletion;
    if (target.role === "admin" || target.email?.toLowerCase() === ADMIN_EMAIL) {
      setError("A conta administrativa protegida não pode ser excluída.");
      return;
    }
    if (!window.confirm(`Confirma a exclusão definitiva do cadastro de ${target.email ?? target.user_id}? Essa ação não poderá ser desfeita.`)) return;
    setBusyId(target.user_id);
    setError("");
    setMessage("");
    const { data, error: deletionError } = await adminSupabase.functions.invoke("admin-delete-user", {
      body: { user_id: target.user_id, reason: userDeleteReason.trim() },
    });
    setBusyId("");
    if (deletionError || data?.error) {
      setError(data?.error ?? deletionError?.message ?? "Não foi possível excluir o cadastro.");
      return;
    }
    setSelectedUserDeletion(null);
    setUserDeleteReason("");
    setMessage(`Cadastro de ${target.email ?? "usuário"} excluído. A ação foi encaminhada à auditoria administrativa.`);
    await load();
  };

  const viewOccurrence = async (occurrence: AdminOccurrence) => {
    setDetailLoading(true);
    setError("");
    setViewingOccurrence(null);
    setOccurrenceHistory([]);
    const [detailResult, historyResult] = await Promise.all([
      adminSupabase.from("ocorrencias").select("*").eq("id", occurrence.id).maybeSingle(),
      adminSupabase.from("ocorrencia_historico").select("*").eq("ocorrencia_id", occurrence.id).order("criado_em", { ascending: true }),
    ]);
    setDetailLoading(false);
    if (detailResult.error || !detailResult.data) {
      setError(detailResult.error?.message ?? "Não foi possível localizar os dados completos desta ocorrência.");
      return;
    }
    setViewingOccurrence(detailResult.data as OccurrenceDetails);
    if (historyResult.error) {
      setError("Ficha carregada, mas o histórico não pôde ser consultado: " + historyResult.error.message);
    } else {
      setOccurrenceHistory((historyResult.data ?? []) as OccurrenceHistory[]);
    }
  };

  const printOccurrence = () => {
    if (!viewingOccurrence) return;
    const escapeHtml = (value: unknown) => String(value ?? "—")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const o = viewingOccurrence;
    const row = (label: string, value: unknown) => `<div class="field"><span>${escapeHtml(label)}</span><p>${escapeHtml(value || "Não informado")}</p></div>`;
    const history = occurrenceHistory.length
      ? occurrenceHistory.map((item) => `<tr><td>${escapeHtml(formatDate(item.criado_em))}</td><td>${escapeHtml(item.acao)}</td><td>${escapeHtml(item.status_anterior || "—")} → ${escapeHtml(item.status_novo || "—")}</td><td>${escapeHtml(item.viatura || "—")}</td><td>${escapeHtml(item.observacao || "—")}</td></tr>`).join("")
      : '<tr><td colspan="5">Nenhum histórico operacional disponível.</td></tr>';
    const doc = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ocorrência ${escapeHtml(o.protocolo)}</title><style>
      @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#111;margin:0}
      header{border-bottom:2px solid #132c46;padding-bottom:12px;margin-bottom:18px;display:flex;align-items:center;gap:14px}
      header img{width:64px;height:64px;object-fit:contain}h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;background:#eef2f6;padding:8px;margin:18px 0 8px}
      .sub{font-size:11px;color:#444}.protocol{font-size:15px;font-weight:bold;margin:14px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.field{border:1px solid #ddd;padding:8px;break-inside:avoid}.field span{font-size:10px;text-transform:uppercase;color:#555}.field p{margin:5px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
      table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}th{background:#eef2f6}
      .signature{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:50px}.signature div{border-top:1px solid #333;text-align:center;padding-top:6px}
      footer{margin-top:18px;font-size:9px;color:#555;border-top:1px solid #ddd;padding-top:8px}
    </style></head><body><header><img src="${escapeHtml(new URL("/aracoiaba-citizen-helper/android-chrome-192x192.png", window.location.origin).href)}" alt="Emblema GCM"><div><h1>Guarda Civil Municipal</h1><div>Araçoiaba da Serra · Ficha administrativa de ocorrência</div></div></header>
    <div class="protocol">Protocolo: ${escapeHtml(o.protocolo)} · Status: ${escapeHtml(o.status)}</div>
    <h2>Identificação e registro</h2><div class="grid">${row("Natureza / categoria",o.categoria)}${row("Prioridade",o.prioridade)}${row("Data do registro",formatDate(o.created_at))}${row("Última atualização",formatDate(o.updated_at))}${row("Solicitante",o.nome)}${row("Telefone",o.telefone)}${row("CPF",o.cpf)}${row("Endereço da ocorrência",o.endereco)}${row("Endereço do solicitante",o.endereco_solicitante)}${row("Viatura",o.viatura)}</div>
    <h2>Descrição da ocorrência</h2><div class="field"><p>${escapeHtml(o.descricao)}</p></div>
    <h2>Providências / observações</h2><div class="field"><p>${escapeHtml(o.observacao)}</p></div>
    <h2>Histórico operacional</h2><table><thead><tr><th>Data e hora</th><th>Ação</th><th>Alteração de status</th><th>Viatura</th><th>Observação</th></tr></thead><tbody>${history}</tbody></table>
    <div class="signature"><div>Responsável pelo registro / conferência</div><div>Visto da chefia</div></div>
    <footer>Documento emitido pelo painel administrativo em ${escapeHtml(new Date().toLocaleString("pt-BR"))}. Contém dados pessoais e deve ser manuseado conforme as regras institucionais de sigilo e proteção de dados.</footer>
    <script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),300)});</script></body></html>`;
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setError("O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente novamente.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(doc);
    printWindow.document.close();
  };

  const deleteOccurrence = async () => {
    if (!selectedOccurrence || deleteReason.trim().length < 5) {
      setError("Informe o motivo da exclusão com pelo menos 5 caracteres.");
      return;
    }
    const occurrence = selectedOccurrence;
    if (!window.confirm(`Confirma a exclusão definitiva de ${occurrence.protocolo}? A ação ficará registrada na auditoria.`)) return;
    setBusyId(occurrence.id);
    setError("");
    setMessage("");
    const { error: deleteError } = await adminSupabase.rpc("admin_delete_occurrence", {
      _occurrence_id: occurrence.id,
      _reason: deleteReason.trim(),
    });
    setBusyId("");
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setSelectedOccurrence(null);
    setDeleteReason("");
    setMessage(`Ocorrência ${occurrence.protocolo} excluída e registrada na auditoria.`);
    await load();
  };

  if (!sessionReady) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Verificando sessão segura…</main>;
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <form onSubmit={login} className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full"><img src="/aracoiaba-citizen-helper/android-chrome-192x192.png" alt="Emblema oficial da Guarda Civil Municipal" className="h-full w-full rounded-full object-cover" /></div>
            <div><h1 className="text-xl font-bold">Administração CAD</h1><p className="text-sm text-muted-foreground">GCM Araçoiaba da Serra</p></div>
          </div>
          <p className="text-sm text-muted-foreground">Entre com a conta administrativa autorizada. A permissão será validada também pelo banco de dados.</p>
          <label className="block space-y-1 text-sm"><span>E-mail</span><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border bg-background px-3 py-3" placeholder="E-mail administrativo" /></label>
          <label className="block space-y-1 text-sm"><span>Senha</span><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border bg-background px-3 py-3" placeholder="Senha" /></label>
          {authError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{authError}</p>}
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"><LockKeyhole className="h-4 w-4" /> Entrar como administrador</button>
          <Link to="/operador" className="block text-center text-sm text-muted-foreground hover:text-foreground">Voltar ao CAD</Link>
        </form>
      </main>
    );
  }

  if (session.user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <ShieldCheck className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold">Acesso administrativo negado</h1>
        <p className="max-w-md text-sm text-muted-foreground">Esta conta não é a conta administrativa autorizada.</p>
        <button onClick={signOut} className="rounded-xl bg-secondary px-4 py-2 font-semibold">Sair e trocar de conta</button>
      </main>
    );
  }

  const tabs: { id: AdminTab; label: string; icon: typeof Users }[] = [
    { id: "usuarios", label: "Usuários", icon: Users },
    { id: "ocorrencias", label: "Ocorrências", icon: ClipboardList },
    { id: "auditoria", label: "Auditoria", icon: History },
  ];

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/90 px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full"><img src="/aracoiaba-citizen-helper/android-chrome-192x192.png" alt="Emblema oficial da Guarda Civil Municipal" className="h-full w-full rounded-full object-cover" /></div>
          <div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">GCM · Araçoiaba da Serra</p><h1 className="text-xl font-bold md:text-2xl">Painel Administrativo</h1><p className="text-xs text-muted-foreground">{session.user.email}</p></div>
          <button onClick={() => void load()} disabled={loading} className="rounded-lg bg-secondary p-2.5" title="Atualizar dados"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
          <button onClick={signOut} className="rounded-lg bg-secondary p-2.5" title="Sair"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link to="/operador" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Voltar à Central de Despacho</Link>
          <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success">Conta administrativa</span>
        </div>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-4"><Users className="mb-2 h-5 w-5 text-primary" /><p className="text-2xl font-bold">{users.length}</p><p className="text-sm text-muted-foreground">Contas cadastradas</p></div>
          <div className="rounded-2xl border border-border bg-card p-4"><ClipboardList className="mb-2 h-5 w-5 text-primary" /><p className="text-2xl font-bold">{occurrences.length}</p><p className="text-sm text-muted-foreground">Ocorrências recentes listadas</p></div>
          <div className="rounded-2xl border border-border bg-card p-4"><History className="mb-2 h-5 w-5 text-primary" /><p className="text-2xl font-bold">{audit.length}</p><p className="text-sm text-muted-foreground">Eventos de auditoria</p></div>
        </div>
        <nav className="mb-5 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-2" aria-label="Seções administrativas">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><Icon className="h-4 w-4" />{label}</button>)}
        </nav>
        {error && <div role="alert" className="mb-4 flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="h-5 w-5 shrink-0" /><span>{error}</span></div>}
        {message && <div role="status" className="mb-4 rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">{message}</div>}
        {!allowed && (checking || !error) && <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Validando autorização administrativa…</div>}
        {!allowed && error && <div className="rounded-xl border border-border bg-card p-5"><h2 className="font-semibold">O painel ainda não pode administrar o banco</h2><p className="mt-2 text-sm text-muted-foreground">A interface não concede privilégios por conta própria. A migração administrativa precisa estar aplicada no projeto Supabase ativo antes de liberar estas funções.</p><button onClick={() => void load()} className="mt-4 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold">Tentar novamente</button></div>}
        {allowed && tab === "usuarios" && <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-4"><h2 className="font-bold">Usuários e permissões</h2><p className="mt-1 text-sm text-muted-foreground">Somente contas aprovadas recebem a função de operador. Bloquear remove a permissão operacional; excluir cadastro remove a conta de autenticação e exige justificativa.</p></div>{selectedUserDeletion && <div className="m-4 space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" /><div><p className="font-semibold">Excluir cadastro de {selectedUserDeletion.email ?? selectedUserDeletion.user_id}</p><p className="text-sm text-muted-foreground">A conta de autenticação será removida. Esta ação é definitiva; confirme que não há necessidade de manter o acesso dessa pessoa.</p></div></div><label className="block space-y-1 text-sm"><span>Justificativa obrigatória</span><textarea value={userDeleteReason} onChange={(event) => setUserDeleteReason(event.target.value)} rows={2} className="w-full rounded-lg border border-border bg-background p-3" placeholder="Informe o motivo da exclusão..." /></label><div className="flex flex-wrap gap-2"><button disabled={busyId === selectedUserDeletion.user_id || userDeleteReason.trim().length < 5} onClick={() => void deleteUserAccount()} className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"><Trash2 className="h-4 w-4" /> Confirmar exclusão</button><button onClick={() => { setSelectedUserDeletion(null); setUserDeleteReason(""); }} className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold">Cancelar</button></div></div>}
          <div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-left text-sm"><thead className="bg-secondary/60 text-xs uppercase text-muted-foreground"><tr><th className="p-3">Operador / identificação funcional</th><th className="p-3">Matrícula</th><th className="p-3">Cargo / lotação</th><th className="p-3">Cadastro</th><th className="p-3">Último acesso</th><th className="p-3">Situação</th><th className="p-3">Ação</th></tr></thead><tbody>{users.map((user) => <tr key={user.user_id} className="border-t border-border"><td className="p-3"><p className="font-semibold">{user.nome_completo || "Perfil não preenchido"}</p><p className="mt-1 text-xs text-muted-foreground">{user.email ?? "E-mail indisponível"}</p><p className="mt-1 max-w-56 truncate text-[10px] text-muted-foreground">{user.user_id}</p></td><td className="p-3">{user.matricula || "—"}</td><td className="p-3"><p>{user.cargo || "—"}</p><p className="text-xs text-muted-foreground">{user.lotacao || "—"}</p></td><td className="p-3">{formatDate(user.created_at)}</td><td className="p-3">{formatDate(user.last_sign_in_at)}</td><td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.role === "admin" ? "bg-primary/15 text-primary" : user.role === "operador" ? "bg-success/10 text-success" : "bg-amber-500/10 text-amber-500"}`}>{user.role === "admin" ? "Administrador" : user.role === "operador" ? "Operador liberado" : "Pendente / sem acesso"}</span></td><td className="p-3">{user.role === "admin" ? <span className="text-xs text-muted-foreground">Conta protegida</span> : <div className="flex flex-col items-start gap-2"><button disabled={busyId === user.user_id} onClick={() => void setOperatorAccess(user, user.role !== "operador")} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${user.role === "operador" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>{user.role === "operador" ? <><Ban className="h-3.5 w-3.5" /> Bloquear</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Liberar acesso</>}</button><button disabled={busyId === user.user_id} onClick={() => { setSelectedUserDeletion(user); setUserDeleteReason(""); }} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Excluir cadastro</button></div>}</td></tr>)}</tbody></table></div>
        </section>}
        {allowed && tab === "ocorrencias" && <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-4"><h2 className="font-bold">Gestão de ocorrências</h2><p className="mt-1 text-sm text-muted-foreground">A exclusão é definitiva, exige justificativa e fica registrada na auditoria administrativa. Prefira manter a ocorrência e alterar seu status quando possível.</p></div>
          {selectedOccurrence && <div className="m-4 space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" /><div><p className="font-semibold">Confirmar exclusão: {selectedOccurrence.protocolo}</p><p className="text-sm text-muted-foreground">{selectedOccurrence.categoria} · Status: {selectedOccurrence.status}</p></div></div><label className="block space-y-1 text-sm"><span>Motivo obrigatório</span><textarea value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} rows={2} className="w-full rounded-lg border border-border bg-background p-3" placeholder="Informe a justificativa administrativa..." /></label><div className="flex flex-wrap gap-2"><button disabled={busyId === selectedOccurrence.id || deleteReason.trim().length < 5} onClick={() => void deleteOccurrence()} className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"><Trash2 className="h-4 w-4" /> Confirmar exclusão</button><button onClick={() => { setSelectedOccurrence(null); setDeleteReason(""); }} className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold">Cancelar</button></div></div>}
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-secondary/60 text-xs uppercase text-muted-foreground"><tr><th className="p-3">Protocolo</th><th className="p-3">Categoria</th><th className="p-3">Status</th><th className="p-3">Registro</th><th className="p-3">Ação administrativa</th></tr></thead><tbody>{occurrences.map((occurrence) => <tr key={occurrence.id} className="border-t border-border"><td className="p-3 font-semibold">{occurrence.protocolo}</td><td className="p-3">{occurrence.categoria}</td><td className="p-3">{occurrence.status}</td><td className="p-3">{formatDate(occurrence.created_at)}</td><td className="p-3"><div className="flex flex-wrap gap-2"><button onClick={() => void viewOccurrence(occurrence)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"><Eye className="h-3.5 w-3.5" /> Visualizar</button><button onClick={() => { setSelectedOccurrence(occurrence); setDeleteReason(""); }} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"><Trash2 className="h-3.5 w-3.5" /> Excluir</button></div></td></tr>)}</tbody></table></div>
        </section>}
        {allowed && tab === "ocorrencias" && detailLoading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="rounded-xl border border-border bg-card p-6 text-sm">Carregando ficha completa da ocorrência…</div></div>}
        {allowed && tab === "ocorrencias" && viewingOccurrence && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3 md:p-8" role="dialog" aria-modal="true" aria-labelledby="occurrence-detail-title">
          <section className="mx-auto max-w-4xl rounded-2xl border border-border bg-card shadow-2xl">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 md:p-6"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Ficha completa da ocorrência</p><h2 id="occurrence-detail-title" className="text-xl font-bold">{viewingOccurrence.protocolo}</h2><p className="text-sm text-muted-foreground">{viewingOccurrence.categoria} · {viewingOccurrence.status}</p></div><div className="flex gap-2"><button onClick={printOccurrence} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><FileDown className="h-4 w-4" /> Gerar PDF / Imprimir</button><button onClick={() => setViewingOccurrence(null)} aria-label="Fechar ficha" className="rounded-lg bg-secondary p-2"><X className="h-5 w-5" /></button></div></header>
            <div className="space-y-5 p-4 md:p-6">
              <div><h3 className="mb-2 font-semibold">Identificação e registro</h3><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
                ["Natureza / categoria", viewingOccurrence.categoria], ["Prioridade", viewingOccurrence.prioridade], ["Status", viewingOccurrence.status], ["Data do registro", formatDate(viewingOccurrence.created_at)], ["Última atualização", formatDate(viewingOccurrence.updated_at)], ["Solicitante", viewingOccurrence.nome], ["Telefone", viewingOccurrence.telefone], ["CPF", viewingOccurrence.cpf], ["Endereço da ocorrência", viewingOccurrence.endereco], ["Endereço do solicitante", viewingOccurrence.endereco_solicitante], ["Viatura", viewingOccurrence.viatura],
              ].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-background/40 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value || "Não informado"}</dd></div>)}</dl></div>
              <div><h3 className="mb-2 font-semibold">Descrição da ocorrência</h3><p className="whitespace-pre-wrap break-words rounded-lg border border-border p-4 text-sm">{viewingOccurrence.descricao || "Sem descrição registrada."}</p></div>
              <div><h3 className="mb-2 font-semibold">Providências e observações</h3><p className="whitespace-pre-wrap break-words rounded-lg border border-border p-4 text-sm">{viewingOccurrence.observacao || "Nenhuma observação registrada."}</p></div>
              <div><h3 className="mb-2 font-semibold">Histórico operacional</h3>{occurrenceHistory.length ? <div className="space-y-2">{occurrenceHistory.map((item) => <article key={item.id} className="rounded-lg border border-border p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{item.acao}</p><time className="text-xs text-muted-foreground">{formatDate(item.criado_em)}</time></div><p className="mt-1 text-xs text-muted-foreground">Status: {item.status_anterior || "—"} → {item.status_novo || "—"} · Viatura: {item.viatura || "—"}</p>{item.observacao && <p className="mt-2 whitespace-pre-wrap text-sm">{item.observacao}</p>}<p className="mt-1 break-all text-[11px] text-muted-foreground">Operador ID: {item.operador_id}</p></article>)}</div> : <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">Nenhum histórico operacional disponível.</p>}</div>
              <p className="text-xs text-muted-foreground">O PDF contém dados pessoais e deve ser utilizado e armazenado conforme as regras institucionais de sigilo e proteção de dados.</p>
            </div>
          </section>
        </div>}
        {allowed && tab === "auditoria" && <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-4"><h2 className="font-bold">Auditoria administrativa</h2><p className="mt-1 text-sm text-muted-foreground">Registro de liberações, bloqueios e exclusões com usuário responsável, data e detalhes.</p></div>
          <div className="divide-y divide-border">
            {audit.length === 0 && <p className="p-5 text-sm text-muted-foreground">Nenhuma ação administrativa registrada até o momento.</p>}
            {audit.map((entry) => {
              const action = getAuditAction(entry.action);
              const details = auditDetails(entry.details);
              const toneClass = action.tone === "success"
                ? "border-success/30 bg-success/10 text-success"
                : action.tone === "warning"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                  : action.tone === "danger"
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-border bg-secondary/70 text-muted-foreground";
              return <article key={entry.id} className="p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`mt-0.5 rounded-xl border p-2 ${toneClass}`}>
                      {action.category === "Acesso" ? <ShieldCheck className="h-5 w-5" /> : action.category === "Ocorrência" ? <ClipboardList className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{action.title}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>{action.category}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">Responsável: <span className="break-all text-foreground">{entry.actor_email || "Não identificado"}</span></p>
                    </div>
                  </div>
                  <time dateTime={entry.created_at} className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</time>
                </div>
                {details.length > 0 && <dl className="mt-4 grid gap-2 rounded-xl border border-border bg-background/40 p-3 sm:grid-cols-2">
                  {details.map((detail) => <div key={detail.key} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{detail.label}</dt>
                    <dd className="mt-0.5 break-words text-sm font-medium">{detail.value}</dd>
                  </div>)}
                </dl>}
                {(entry.target_user_id || entry.occurrence_id) && <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Detalhes técnicos e identificadores</summary>
                  <dl className="mt-2 grid gap-2 rounded-lg bg-secondary/50 p-3 text-xs sm:grid-cols-2">
                    {entry.target_user_id && <div className="min-w-0"><dt className="text-muted-foreground">ID do usuário</dt><dd className="break-all">{entry.target_user_id}</dd></div>}
                    {entry.occurrence_id && <div className="min-w-0"><dt className="text-muted-foreground">ID da ocorrência</dt><dd className="break-all">{entry.occurrence_id}</dd></div>}
                    <div className="min-w-0"><dt className="text-muted-foreground">Evento técnico</dt><dd className="break-all">{entry.action}</dd></div>
                  </dl>
                </details>}
              </article>;
            })}
          </div>
        </section>}
        <p className="mt-5 text-xs text-muted-foreground">A interface não armazena senhas. Todas as ações privilegiadas são verificadas no banco e registradas na auditoria.</p>
      </div>
    </main>
  );
}
