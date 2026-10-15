import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft, ShieldCheck, Users, ClipboardList, History, RefreshCw, BellRing, Volume2, VolumeX, CarFront, Plus, ExternalLink, BarChart3,
  LogOut, CheckCircle2, Ban, Trash2, AlertTriangle, LockKeyhole, Eye, FileDown, X, Pencil, Save, Search,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import type { Json } from "@/integrations/supabase/types";

const ADMIN_EMAIL = "andersonf.g.marques@gmail.com";
type AdminTab = "usuarios" | "ocorrencias" | "viaturas" | "equipes" | "estatisticas" | "auditoria";
type AdminVehicle = { vehicle: string; active: boolean; created_at: string; created_by: string | null };
type AdminMember = { id: string; nome: string; matricula: string; cargo: string; equipe: "Alpha" | "Bravo" | "Charlie" | "Delta"; ativo: boolean; created_at: string; created_by: string | null };
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
type StatsOccurrence = { created_at: string; categoria: string; status: string; prioridade: string; viatura: string | null };
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
      { title: "Administração CAD | GCM Integrativa · Araçoiaba da Serra" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("pt-BR") : "Nunca";
}

function parseOccurrenceMetadata(description: string) {
  const aggressor = description.match(/\[TRIAGEM_VIOLENCIA_DOMESTICA: POSSIVEL_AGRESSOR=([^\]\n]*)\]/)?.[1] ?? null;
  const measure = description.match(/\[TRIAGEM_MEDIDA_PROTETIVA: ([^\]\n]*)\]/)?.[1] ?? null;
  const attachmentPath = description.match(/\[ANEXO_MEDIDA_PROTETIVA: path=([^\]\n]+)\]/)?.[1] ?? null;
  const attachmentFailed = /\[ANEXO_MEDIDA_PROTETIVA: ENVIO_FALHOU; DOCUMENTO_NAO_RECEBIDO\]/.test(description);
  const cleanDescription = description
    .replace(/\n?\[TRIAGEM_VIOLENCIA_DOMESTICA: POSSIVEL_AGRESSOR=[^\]\n]*\]/g, "")
    .replace(/\n?\[TRIAGEM_MEDIDA_PROTETIVA: [^\]\n]*\]/g, "")
    .replace(/\n?\[ANEXO_MEDIDA_PROTETIVA: path=[^\]\n]+\]/g, "")
    .replace(/\n?\[ANEXO_MEDIDA_PROTETIVA: ENVIO_FALHOU; DOCUMENTO_NAO_RECEBIDO\]/g, "")
    .replace(/\n?\[REGISTRO_TERMO_ART340: ACEITO_EM=[^\]\n]+\]/g, "")
    .replace(/\n?\[REGISTRO_TERMO_VERACIDADE: VERSAO=[^;]+; ACEITO_EM=[^\]\n]+\]/g, "")
    .trim();
  return { aggressor, measure, attachmentPath, attachmentFailed, cleanDescription };
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
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);
  const [newVehicleName, setNewVehicleName] = useState("");
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [memberForm, setMemberForm] = useState({ nome: "", matricula: "", cargo: "", equipe: "Alpha" as AdminMember["equipe"] });
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [savingMember, setSavingMember] = useState(false);
  const [occurrences, setOccurrences] = useState<AdminOccurrence[]>([]);
  const [statsStart, setStatsStart] = useState(`${new Date().getFullYear()}-01-01`);
  const [statsEnd, setStatsEnd] = useState(new Date().toISOString().slice(0, 10));
  const [statsRows, setStatsRows] = useState<StatsOccurrence[]>([]);
  const [statsPreviousRows, setStatsPreviousRows] = useState<StatsOccurrence[]>([]);
  const [statsCategoryFilter, setStatsCategoryFilter] = useState("Todas");
  const [statsStatusFilter, setStatsStatusFilter] = useState("Todos");
  const [statsPriorityFilter, setStatsPriorityFilter] = useState("Todas");
  const [statsVehicleFilter, setStatsVehicleFilter] = useState("Todas");
  const [statsDayFilter, setStatsDayFilter] = useState("Todos");
  const [statsHourFilter, setStatsHourFilter] = useState("Todas");
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [protocolSearch, setProtocolSearch] = useState("");
  const [protocolSearchActive, setProtocolSearchActive] = useState(false);
  const [searchingProtocol, setSearchingProtocol] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<AuditEntry | null>(null);
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
  const [editingProfile, setEditingProfile] = useState<AdminUser | null>(null);
  const [profileForm, setProfileForm] = useState({ nome_completo: "", matricula: "", cargo: "", lotacao: "" });
  const [adminSoundEnabled, setAdminSoundEnabled] = useState(false);
  const [newAdminOccurrenceCount, setNewAdminOccurrenceCount] = useState(0);
  const [adminAlertMessage, setAdminAlertMessage] = useState("");
  const [liveConnection, setLiveConnection] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const adminAudioRef = useRef<AudioContext | null>(null);
  const adminSoundEnabledRef = useRef(false);
  const notifiedAdminOccurrenceIds = useRef<Set<string>>(new Set());

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


  const addVehicle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const vehicle = newVehicleName.trim().replace(/\\s+/g, " ").toUpperCase();
    if (!vehicle) return;
    if (vehicle.length > 40) { setError("O nome da viatura deve ter no máximo 40 caracteres."); return; }
    setSavingVehicle(true);
    setError("");
    setMessage("");
    const { error: insertError } = await adminSupabase.from("gcm_vehicles").insert({
      vehicle, active: true, created_by: session?.user.id ?? null,
    });
    setSavingVehicle(false);
    if (insertError) {
      setError(insertError.code === "23505" ? "Já existe uma viatura com esse identificador." : "Não foi possível cadastrar a viatura: " + insertError.message);
      return;
    }
    const { error: statusError } = await adminSupabase.from("gcm_vehicle_status").insert({ vehicle, status: "disponivel" });
    setNewVehicleName("");
    const { data, error: refreshError } = await adminSupabase.from("gcm_vehicles").select("vehicle,active,created_at,created_by").order("vehicle");
    if (!refreshError) setVehicles((data ?? []) as AdminVehicle[]);
    setMessage(statusError ? "Viatura cadastrada. Atualize a frota; a criação do estado operacional precisa ser verificada." : "Viatura cadastrada e disponibilizada no painel CAD.");
  };

  const toggleVehicleActive = async (vehicle: AdminVehicle) => {
    setBusyId(vehicle.vehicle);
    setError("");
    setMessage("");
    const { error: updateError } = await adminSupabase.from("gcm_vehicles")
      .update({ active: !vehicle.active })
      .eq("vehicle", vehicle.vehicle);
    setBusyId("");
    if (updateError) { setError("Não foi possível atualizar a viatura: " + updateError.message); return; }
    const { data, error: refreshError } = await adminSupabase.from("gcm_vehicles").select("vehicle,active,created_at,created_by").order("vehicle");
    if (refreshError) setError("Viatura atualizada, mas não foi possível recarregar a lista: " + refreshError.message);
    else setVehicles((data ?? []) as AdminVehicle[]);
    setMessage(vehicle.active ? `${vehicle.vehicle} foi desativada e não aparecerá no CAD.` : `${vehicle.vehicle} foi reativada e aparecerá no CAD.`);
  };

  const addMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      nome: memberForm.nome.trim().replace(/\s+/g, " "),
      matricula: memberForm.matricula.trim().toUpperCase(),
      cargo: memberForm.cargo.trim().replace(/\s+/g, " "),
      equipe: memberForm.equipe,
      ativo: true,
      created_by: session?.user.id ?? null,
    };
    if (payload.nome.length < 2 || payload.matricula.length < 2 || payload.cargo.length < 2) {
      setError("Preencha nome, matrícula e cargo/graduação corretamente.");
      return;
    }
    setSavingMember(true); setError(""); setMessage("");
    const { error: saveError } = editingMemberId
      ? await adminSupabase.from("gcm_members").update({
          nome: payload.nome, matricula: payload.matricula, cargo: payload.cargo, equipe: payload.equipe,
        }).eq("id", editingMemberId)
      : await adminSupabase.from("gcm_members").insert(payload);
    setSavingMember(false);
    if (saveError) {
      setError(saveError.code === "23505" ? "Já existe um GCM cadastrado com essa matrícula." : "Não foi possível salvar o cadastro do GCM: " + saveError.message);
      return;
    }
    const estavaEditando = Boolean(editingMemberId);
    setEditingMemberId(null);
    setMemberForm({ nome: "", matricula: "", cargo: "", equipe: memberForm.equipe });
    const { data, error: refreshError } = await adminSupabase.from("gcm_members").select("id,nome,matricula,cargo,equipe,ativo,created_at,created_by").order("equipe").order("nome");
    if (refreshError) setError("Cadastro salvo, mas não foi possível atualizar a lista: " + refreshError.message);
    else setMembers((data ?? []) as AdminMember[]);
    setMessage(estavaEditando ? "Cadastro do GCM atualizado." : "GCM cadastrado e disponibilizado para seleção no CAD.");
  };

  const toggleMemberActive = async (member: AdminMember) => {
    setBusyId(member.id); setError(""); setMessage("");
    const { error: updateError } = await adminSupabase.from("gcm_members").update({ ativo: !member.ativo }).eq("id", member.id);
    setBusyId("");
    if (updateError) { setError("Não foi possível atualizar o cadastro do GCM: " + updateError.message); return; }
    const { data, error: refreshError } = await adminSupabase.from("gcm_members").select("id,nome,matricula,cargo,equipe,ativo,created_at,created_by").order("equipe").order("nome");
    if (refreshError) setError("Cadastro atualizado, mas não foi possível recarregar a lista: " + refreshError.message);
    else setMembers((data ?? []) as AdminMember[]);
    setMessage(member.ativo ? `${member.nome} foi desativado e não aparecerá em novos despachos.` : `${member.nome} foi reativado para seleção no CAD.`);
  };

  const filteredStatsRows = statsRows.filter((row) =>
    (statsCategoryFilter === "Todas" || (row.categoria || "Não informado") === statsCategoryFilter) &&
    (statsStatusFilter === "Todos" || (row.status || "Não informado") === statsStatusFilter) &&
    (statsPriorityFilter === "Todas" || (row.prioridade || "Não informado") === statsPriorityFilter) &&
    (statsVehicleFilter === "Todas" || (row.viatura || "Não informado") === statsVehicleFilter) &&
    (statsDayFilter === "Todos" || String(new Date(row.created_at).getDay()) === statsDayFilter) &&
    (statsHourFilter === "Todas" || String(new Date(row.created_at).getHours()) === statsHourFilter)
  );
  const filteredPreviousStatsRows = statsPreviousRows.filter((row) =>
    (statsCategoryFilter === "Todas" || (row.categoria || "Não informado") === statsCategoryFilter) &&
    (statsStatusFilter === "Todos" || (row.status || "Não informado") === statsStatusFilter) &&
    (statsPriorityFilter === "Todas" || (row.prioridade || "Não informado") === statsPriorityFilter) &&
    (statsVehicleFilter === "Todas" || (row.viatura || "Não informado") === statsVehicleFilter) &&
    (statsDayFilter === "Todos" || String(new Date(row.created_at).getDay()) === statsDayFilter) &&
    (statsHourFilter === "Todas" || String(new Date(row.created_at).getHours()) === statsHourFilter)
  );
  const weekdayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const loadOccurrenceStatistics = async () => {
    if (!statsStart || !statsEnd || statsStart > statsEnd) { setError("Informe um intervalo de datas válido para as estatísticas."); return; }
    const start = new Date(`${statsStart}T00:00:00-03:00`);
    const end = new Date(`${statsEnd}T00:00:00-03:00`); end.setDate(end.getDate() + 1);
    if (end.getTime() - start.getTime() > 5 * 366 * 24 * 60 * 60 * 1000) { setError("Selecione um período de até cinco anos."); return; }
    setStatsLoading(true); setError("");
    const duration = end.getTime() - start.getTime();
    const previousStart = new Date(start.getTime() - duration);
    const [{ data, error: statsError }, { data: previousData, error: previousError }] = await Promise.all([
      adminSupabase.rpc("admin_occurrence_statistics", { _start: start.toISOString(), _end: end.toISOString() }),
      adminSupabase.rpc("admin_occurrence_statistics", { _start: previousStart.toISOString(), _end: start.toISOString() }),
    ]);
    setStatsLoading(false);
    if (statsError) { setError("Não foi possível gerar as estatísticas: " + statsError.message); return; }
    setStatsRows((data ?? []) as StatsOccurrence[]);
    setStatsPreviousRows(previousError ? [] : (previousData ?? []) as StatsOccurrence[]);
    setStatsLoaded(true);
  };

  const printStatisticsReport = () => {
    const win = window.open("", "_blank");
    if (!win) { setError("Permita a abertura de janelas para gerar o relatório PDF."); return; }
    const esc = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const countBy = (key: "categoria" | "status" | "prioridade" | "viatura") => { const counts = new Map<string, number>(); filteredStatsRows.forEach((row) => { const label = row[key] || "Não informado"; counts.set(label, (counts.get(label) ?? 0) + 1); }); return [...counts.entries()].sort((a,b) => b[1]-a[1]); };
    const table = (title: string, rows: [string, number][]) => `<h2>${esc(title)}</h2><table><thead><tr><th>Classificação</th><th>Quantidade</th><th>Percentual</th></tr></thead><tbody>${rows.map(([label,count]) => `<tr><td>${esc(label)}</td><td>${count}</td><td>${filteredStatsRows.length ? (count*100/filteredStatsRows.length).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%" : "0%"}</td></tr>`).join("")}</tbody></table>`;
    const months = new Map<string,number>(); filteredStatsRows.forEach(row => { const month = row.created_at.slice(0,7); months.set(month,(months.get(month)||0)+1); });
    const weekdayCounts = new Map<string,number>(); filteredStatsRows.forEach(row=>{const key=new Date(row.created_at).getDay();weekdayCounts.set(weekdayNames[key],(weekdayCounts.get(weekdayNames[key])||0)+1)});
    const hourCounts = new Map<string,number>(); filteredStatsRows.forEach(row=>{const hour=new Date(row.created_at).getHours();const key=`${String(hour).padStart(2,"0")}:00–${String((hour+1)%24).padStart(2,"0")}:00`;hourCounts.set(key,(hourCounts.get(key)||0)+1)});
    const endInclusive = new Date(`${statsEnd}T12:00:00`);
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Estatístico GCM Integrativa</title><style>body{font:12px Arial,sans-serif;color:#172033;margin:28px}h1{font-size:21px}h2{font-size:15px;margin-top:24px}p{line-height:1.5}.cards{display:flex;gap:12px}.card{border:1px solid #ccd4df;padding:12px;flex:1}table{border-collapse:collapse;width:100%;margin-top:8px}th,td{border:1px solid #ccd4df;text-align:left;padding:7px}th{background:#eef2f7}footer{margin-top:28px;font-size:10px;color:#4b5563}@media print{body{margin:15mm}}</style></head><body><h1>Guarda Civil Municipal de Araçoiaba da Serra</h1><p><b>GCM Integrativa — Segurança, Cidadania e Proteção</b><br>Relatório estatístico de ocorrências<br>Período: ${esc(new Date(`${statsStart}T12:00:00`).toLocaleDateString("pt-BR"))} a ${esc(endInclusive.toLocaleDateString("pt-BR"))}</p><p><b>Filtros:</b> categoria ${esc(statsCategoryFilter)}; status ${esc(statsStatusFilter)}; prioridade ${esc(statsPriorityFilter)}; viatura ${esc(statsVehicleFilter)}.</p><div class="cards"><div class="card"><b>Total de registros filtrados</b><h2>${filteredStatsRows.length}</h2></div><div class="card"><b>Encerradas</b><h2>${filteredStatsRows.filter(x=>x.status.toLowerCase()==="encerrada").length}</h2></div><div class="card"><b>Alta prioridade</b><h2>${filteredStatsRows.filter(x=>/alta|urgente|alta prioridade/i.test(x.prioridade||"")).length}</h2></div></div>${table("Ocorrências por mês",[...months.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([m,n])=>[new Date(`${m}-01T12:00:00`).toLocaleDateString("pt-BR",{month:"long",year:"numeric"}),n] as [string,number]))}${table("Por categoria",countBy("categoria"))}${table("Por status",countBy("status"))}${table("Por prioridade",countBy("prioridade"))}${table("Por viatura",countBy("viatura"))}${table("Por dia da semana",[...weekdayCounts.entries()].sort((a,b)=>weekdayNames.indexOf(a[0])-weekdayNames.indexOf(b[0])))}${table("Por faixa horária",[...hourCounts.entries()].sort((a,b)=>a[0].localeCompare(b[0])))}<footer>Gerado em ${esc(new Date().toLocaleString("pt-BR"))}. Documento estatístico agregado, sem identificação de cidadãos. Baseado nos registros existentes no sistema no momento da emissão; não representa necessariamente todos os atendimentos da instituição.</footer><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  const printAuditReport = (entry: AuditEntry) => {
    const esc = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
    const action = getAuditAction(entry.action);
    const details = auditDetails(entry.details);
    const rows = details.map((item) => "<tr><th>" + esc(item.label) + "</th><td>" + esc(item.value) + "</td></tr>").join("") || "<tr><th>Detalhes</th><td>Não há detalhes adicionais registrados.</td></tr>";
    const technical = [["ID do evento", entry.id], ["Ação técnica", entry.action], ["ID da conta afetada", entry.target_user_id], ["ID da ocorrência", entry.occurrence_id]].filter((item) => item[1]).map((item) => "<tr><th>" + esc(item[0]) + "</th><td>" + esc(item[1]) + "</td></tr>").join("");
    const win = window.open("", "_blank");
    if (!win) { setError("O navegador bloqueou a janela do relatório. Permita pop-ups e tente novamente."); return; }
    win.document.write("<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'><title>Relatório de auditoria</title><style>@page{size:A4;margin:18mm}body{font:11pt Arial,sans-serif;color:#111827;line-height:1.45}header{display:flex;align-items:center;justify-content:center;gap:18px;text-align:center;border-bottom:2px solid #172554;padding-bottom:14px;margin-bottom:22px}header img{width:76px;height:76px;object-fit:contain}header h1{font-size:17pt;margin:0 0 5px}header p{margin:3px 0}h2{font-size:12pt;margin:22px 0 8px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{text-align:left;vertical-align:top;border:1px solid #d1d5db;padding:8px;overflow-wrap:anywhere}th{width:34%;background:#f3f4f6}footer{margin-top:28px;border-top:1px solid #9ca3af;padding-top:8px;font-size:8pt;color:#4b5563}</style></head><body>" +
      "<header><img src='/aracoiaba-citizen-helper/BrasaoOfc.png' alt='Brasão da Guarda Civil Municipal'><div><h1>Guarda Civil Municipal</h1><p>Araçoiaba da Serra — SP</p><p>Relatório de auditoria administrativa</p></div></header>" +
      "<h2>Identificação do evento</h2><table><tr><th>Evento</th><td>" + esc(action.title) + "</td></tr><tr><th>Categoria</th><td>" + esc(action.category) + "</td></tr><tr><th>Data e hora</th><td>" + esc(formatDate(entry.created_at)) + "</td></tr><tr><th>Responsável</th><td>" + esc(entry.actor_email || "Não identificado") + "</td></tr></table>" +
      "<h2>Detalhes registrados</h2><table>" + rows + "</table><h2>Identificadores técnicos</h2><table>" + (technical || "<tr><th>Identificadores</th><td>Não disponíveis</td></tr>") + "</table>" +
      "<footer>Relatório gerado em " + esc(formatDate(new Date().toISOString())) + ". Documento baseado no registro original da auditoria; não altera o evento. Manusear conforme as normas institucionais de sigilo e proteção de dados.</footer></body></html>");
    win.onload = () => { win.focus(); win.print(); };
    win.document.close();
  };

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
    const { data: vehicleData, error: vehicleError } = await adminSupabase
      .from("gcm_vehicles")
      .select("vehicle,active,created_at,created_by")
      .order("vehicle");
    if (vehicleError) setError("Usuários carregados, mas não foi possível consultar a frota: " + vehicleError.message);
    else setVehicles((vehicleData ?? []) as AdminVehicle[]);
    const { data: memberData, error: memberError } = await adminSupabase.from("gcm_members").select("id,nome,matricula,cargo,equipe,ativo,created_at,created_by").order("equipe").order("nome");
    if (memberError) setError((current) => current ? current + " | Cadastro de GCMs: " + memberError.message : "Não foi possível carregar o cadastro de GCMs: " + memberError.message);
    else setMembers((memberData ?? []) as AdminMember[]);
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

  const toggleAdminSound = async () => {
    try {
      if (adminSoundEnabledRef.current) {
        adminSoundEnabledRef.current = false;
        setAdminSoundEnabled(false);
        return;
      }
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) {
        window.alert("Este navegador não oferece suporte ao alerta sonoro.");
        return;
      }
      if (!adminAudioRef.current) adminAudioRef.current = new AudioContextConstructor();
      await adminAudioRef.current.resume();
      adminSoundEnabledRef.current = true;
      setAdminSoundEnabled(true);
      const oscillator = adminAudioRef.current.createOscillator();
      const gain = adminAudioRef.current.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, adminAudioRef.current.currentTime);
      gain.gain.setValueAtTime(0.0001, adminAudioRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, adminAudioRef.current.currentTime + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, adminAudioRef.current.currentTime + 0.25);
      oscillator.connect(gain);
      gain.connect(adminAudioRef.current.destination);
      oscillator.start();
      oscillator.stop(adminAudioRef.current.currentTime + 0.27);
      if ("Notification" in window && Notification.permission === "default") {
        void Notification.requestPermission().catch(() => undefined);
      }
    } catch {
      window.alert("Não foi possível ativar o som. Verifique as permissões de áudio do navegador.");
    }
  };

  useEffect(() => {
    if (!session || !allowed) {
      setLiveConnection("connecting");
      return;
    }
    let active = true;
    const channel = adminSupabase
      .channel("admin-occurrence-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "ocorrencias" }, (payload) => {
        if (!active) return;
        if (payload.eventType === "INSERT") {
          const occurrence = payload.new as AdminOccurrence;
          if (occurrence.status === "pendente" && !notifiedAdminOccurrenceIds.current.has(occurrence.id)) {
            notifiedAdminOccurrenceIds.current.add(occurrence.id);
            setNewAdminOccurrenceCount((count) => count + 1);
            setAdminAlertMessage(`Nova ocorrência pendente recebida: ${occurrence.protocolo || "protocolo não informado"}.`);
            if (adminSoundEnabledRef.current && adminAudioRef.current) {
              try {
                const context = adminAudioRef.current;
                const oscillator = context.createOscillator();
                const gain = context.createGain();
                oscillator.type = "sine";
                oscillator.frequency.setValueAtTime(880, context.currentTime);
                oscillator.frequency.setValueAtTime(660, context.currentTime + 0.15);
                gain.gain.setValueAtTime(0.0001, context.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.14, context.currentTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.38);
                oscillator.connect(gain);
                gain.connect(context.destination);
                oscillator.start();
                oscillator.stop(context.currentTime + 0.4);
              } catch (error) {
                console.warn("Falha no alerta sonoro administrativo:", error);
              }
            }
            if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
              try {
                new Notification("Nova ocorrência pendente — Administração CAD", {
                  body: `Protocolo: ${occurrence.protocolo || "não informado"}`,
                  icon: "/aracoiaba-citizen-helper/android-chrome-192x192.png",
                  tag: `admin-occurrence-${occurrence.id}`,
                });
              } catch (error) {
                console.warn("Falha na notificação do navegador:", error);
              }
            }
          }
        }
        void load();
      })
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") setLiveConnection("connected");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setLiveConnection("disconnected");
        else setLiveConnection("connecting");
      });
    return () => {
      active = false;
      void adminSupabase.removeChannel(channel);
    };
  }, [session, allowed, load]);

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

  const saveOperatorProfile = async () => {
    if (!editingProfile) return;
    const values = {
      _user_id: editingProfile.user_id,
      _nome_completo: profileForm.nome_completo.trim(),
      _matricula: profileForm.matricula.trim(),
      _cargo: profileForm.cargo.trim(),
      _lotacao: profileForm.lotacao.trim(),
    };
    if (Object.values(profileForm).some((value) => !value.trim())) {
      setError("Preencha nome de guerra, RM, cargo/graduação e lotação.");
      return;
    }
    setBusyId(editingProfile.user_id);
    setError("");
    setMessage("");
    const { error: saveError } = await adminSupabase.rpc("admin_upsert_operator_profile", values);
    setBusyId("");
    if (saveError) {
      setError("Não foi possível salvar os dados funcionais. Confirme se a migração do Supabase foi aplicada: " + saveError.message);
      return;
    }
    setEditingProfile(null);
    setMessage("Dados funcionais do operador salvos.");
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
    const dispatchEntry = [...occurrenceHistory].reverse().find((item) =>
      item.acao.toLowerCase().includes("despacho") && /\[EQUIPE EMPENHADA\]/i.test(item.observacao || ""),
    );
    const dispatchText = (dispatchEntry?.observacao || o.observacao || "").replace(/\\n/g, "\n");
    const teamValue = (field: string) => dispatchText.match(new RegExp(`(?:^|\\n)${field}:\\s*(.*)`, "i"))?.[1]?.trim() || "Não informado";
    const team = [
      ["Encarregado", teamValue("Encarregado") !== "Não informado" ? teamValue("Encarregado") : teamValue("EV")],
      ["Condutor", teamValue("Condutor")],
      ["AUX (1)", teamValue("AUX \\(1\\)")],
      ["AUX (2)", teamValue("AUX \\(2\\)")],
    ];
    const teamHtml = team.map(([label, value]) => row(label, value)).join("");
    const metadata = parseOccurrenceMetadata(o.descricao);
    const art340 = o.descricao.match(/\[REGISTRO_TERMO_ART340: ACEITO_EM=([^\]\n]+)\]/);
    const veracidade = o.descricao.match(/\[REGISTRO_TERMO_VERACIDADE: VERSAO=([^;]+); ACEITO_EM=([^\]\n]+)\]/);
    const descricaoLimpa = metadata.cleanDescription;
    const triageHtml = metadata.aggressor || metadata.measure || metadata.attachmentPath || metadata.attachmentFailed
      ? "<h2>Informações da triagem de violência doméstica</h2><div class=\"grid\">" +
        (metadata.aggressor ? row("Agressor, ameaça ou aproximação", metadata.aggressor) : "") +
        (metadata.measure ? row("Medida protetiva", metadata.measure) : "") +
        (metadata.attachmentPath ? row("Documento da medida protetiva", "Anexo registrado no sistema; consulte o documento pelo CAD.") : "") +
        (metadata.attachmentFailed ? row("Atenção", "O documento não foi recebido pelo sistema. O atendimento não deve ser condicionado ao envio do arquivo.") : "") +
        "</div>"
      : "";
    const consentHtml = "<h2>Termo de ciência — art. 340 do Código Penal</h2><div class=\"field\"><p>O art. 340 do Código Penal trata de provocar a ação de autoridade comunicando ocorrência de crime ou contravenção que se sabe não ter ocorrido. Pena prevista: detenção, de 1 a 6 meses, ou multa.</p><p><strong>Registro de aceite:</strong> " + (art340 ? "ACEITO em " + escapeHtml(formatDate(art340[1]!)) : "Sem registro de aceite") + "</p></div>" +
      "<h2>Declaração de Veracidade das Informações</h2><div class=\"field\"><p>Declaro, para os devidos fins, que as informações prestadas e os documentos apresentados neste atendimento são verdadeiros e correspondem à realidade, assumindo responsabilidade pela veracidade dos dados informados.</p>" +
      "<p>Estou ciente de que a apresentação de informações falsas ou a inserção de declarações inverídicas em documentos poderá acarretar responsabilização civil, administrativa e/ou criminal, conforme a legislação aplicável, especialmente o artigo 299 do Código Penal Brasileiro, quando presentes os requisitos legais para sua configuração.</p>" +
      "<p>Declaro, ainda, estar ciente de que o fornecimento de informações corretas é essencial para o adequado registro, análise e encaminhamento da solicitação à Guarda Civil Municipal.</p><p><strong>Registro de aceite:</strong> " + (veracidade ? "ACEITO · versão " + escapeHtml(veracidade[1]!) + " · " + escapeHtml(formatDate(veracidade[2]!)) : "Sem registro de aceite") + "</p></div>";
    const history = occurrenceHistory.length
      ? occurrenceHistory.map((item) => {
          const marker = "[OPERADOR_FUNCIONAL: ";
          const markerEnd = item.observacao?.indexOf("]") ?? -1;
          const operador = item.observacao?.startsWith(marker) && markerEnd > marker.length ? item.observacao.slice(marker.length, markerEnd) : item.operador_id;
          const observacao = item.observacao?.startsWith(marker) && markerEnd >= 0 ? item.observacao.slice(markerEnd + 1).trim() : item.observacao;
          return "<tr><td>" + escapeHtml(formatDate(item.criado_em)) + "</td><td>" + escapeHtml(item.acao) + "</td><td>" + escapeHtml(operador) + "</td><td>" + escapeHtml(item.status_anterior || "—") + " → " + escapeHtml(item.status_novo || "—") + "</td><td>" + escapeHtml(item.viatura || "—") + "</td><td>" + escapeHtml(observacao || "—") + "</td></tr>";
        }).join("")
      : '<tr><td colspan="6">Nenhum histórico operacional disponível.</td></tr>';
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
    <h2>Integrantes da equipe empenhada</h2><div class="grid">${teamHtml}</div>
    ${triageHtml}
    <h2>Descrição da ocorrência</h2><div class="field"><p>${escapeHtml(descricaoLimpa || "Sem descrição registrada.")}</p></div>
     ${consentHtml}
    <h2>Providências / observações</h2><div class="field"><p>${escapeHtml(o.observacao)}</p></div>
    <h2>Histórico operacional</h2><table><thead><tr><th>Data e hora</th><th>Ação</th><th>Operador responsável</th><th>Alteração de status</th><th>Viatura</th><th>Observação</th></tr></thead><tbody>${history}</tbody></table>
    <div class="signature"><div>Responsável pelo registro / conferência</div><div>Visto da chefia</div></div>
    <footer>Documento emitido pelo painel administrativo em ${escapeHtml(new Date().toLocaleString("pt-BR"))}. Contém dados pessoais e deve ser manuseado conforme as regras institucionais de sigilo e proteção de dados.</footer>
    <script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),300)});</script></body></html>`;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente novamente.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(doc);
    printWindow.document.close();
  };

  const searchOccurrencesByProtocol = async (event?: FormEvent) => {
    event?.preventDefault();
    const term = protocolSearch.trim();
    if (term.length < 3) {
      setError("Digite pelo menos 3 caracteres do protocolo para pesquisar.");
      return;
    }
    setSearchingProtocol(true);
    setError("");
    setMessage("");
    const { data, error: searchError } = await adminSupabase.rpc("admin_search_occurrences", { _protocol: term });
    setSearchingProtocol(false);
    if (searchError) {
      setError("Não foi possível pesquisar o protocolo: " + searchError.message);
      return;
    }
    setOccurrences((data ?? []) as AdminOccurrence[]);
    setProtocolSearchActive(true);
    setMessage((data?.length ?? 0) === 0
      ? "Nenhuma ocorrência encontrada para esse protocolo."
      : `${data?.length ?? 0} ocorrência(s) encontrada(s).`);
  };

  const clearProtocolSearch = async () => {
    setProtocolSearch("");
    setProtocolSearchActive(false);
    setSearchingProtocol(true);
    setError("");
    setMessage("");
    const { data, error: listError } = await adminSupabase.rpc("admin_list_occurrences");
    setSearchingProtocol(false);
    if (listError) {
      setError("Não foi possível carregar a lista de ocorrências: " + listError.message);
      return;
    }
    setOccurrences((data ?? []) as AdminOccurrence[]);
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
            <div><h1 className="text-xl font-bold">Administração CAD · GCM Integrativa</h1><p className="text-sm text-muted-foreground">Araçoiaba da Serra · SP</p></div>
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
    { id: "viaturas", label: "Viaturas", icon: CarFront },
    { id: "equipes", label: "Equipes / GCMs", icon: Users },
    { id: "estatisticas", label: "Estatísticas", icon: BarChart3 },
    { id: "auditoria", label: "Auditoria", icon: History },
  ];

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/90 px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full"><img src="/aracoiaba-citizen-helper/android-chrome-192x192.png" alt="Emblema oficial da Guarda Civil Municipal" className="h-full w-full rounded-full object-cover" /></div>
          <div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">GCM Integrativa · Araçoiaba da Serra</p><h1 className="text-xl font-bold md:text-2xl">Painel Administrativo</h1><p className="text-xs text-muted-foreground">{session.user.email}</p></div>
          <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold ${liveConnection === "connected" ? "bg-success/10 text-success" : liveConnection === "disconnected" ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"}`} role="status" aria-live="polite" title={liveConnection === "connected" ? "Notificações em tempo real conectadas" : liveConnection === "disconnected" ? "Conexão de notificações interrompida" : "Conectando notificações"}><span className={`h-2 w-2 rounded-full ${liveConnection === "connected" ? "bg-success" : liveConnection === "disconnected" ? "bg-destructive" : "bg-amber-500 animate-pulse"}`} />{liveConnection === "connected" ? "Ao vivo" : liveConnection === "disconnected" ? "Sem conexão" : "Conectando"}</div>
          <button onClick={toggleAdminSound} className={`rounded-lg p-2.5 ${adminSoundEnabled ? "bg-primary/15 text-primary" : "bg-secondary"}`} title={adminSoundEnabled ? "Desativar alertas sonoros" : "Ativar alertas sonoros"} aria-pressed={adminSoundEnabled}>{adminSoundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
          <button onClick={() => { setNewAdminOccurrenceCount(0); setMessage(""); void load(); }} disabled={loading} className="relative rounded-lg bg-secondary p-2.5" title="Atualizar dados"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{newAdminOccurrenceCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{newAdminOccurrenceCount > 99 ? "99+" : newAdminOccurrenceCount}</span>}</button>
          <button onClick={signOut} className="rounded-lg bg-secondary p-2.5" title="Sair"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link to="/operador" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Voltar à Central de Despacho</Link>
          <Link to="/divulgar" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"><ExternalLink className="h-4 w-4" /> QR Code / Divulgação</Link>
          <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success">Conta administrativa</span>
          {newAdminOccurrenceCount > 0 && <button onClick={() => { setTab("ocorrencias"); setNewAdminOccurrenceCount(0); }} className="inline-flex animate-pulse items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive" aria-live="polite"><BellRing className="h-4 w-4" />{newAdminOccurrenceCount} nova(s) ocorrência(s)</button>}
        </div>
        {adminAlertMessage && <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm" role="alert" aria-live="assertive"><BellRing className="mt-0.5 h-5 w-5 shrink-0 animate-pulse text-destructive" /><div className="min-w-0 flex-1"><p className="font-bold text-destructive">Nova ocorrência pendente</p><p className="mt-1">{adminAlertMessage}</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => { setTab("ocorrencias"); setNewAdminOccurrenceCount(0); setAdminAlertMessage(""); }} className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground">Ver ocorrências</button><button onClick={() => setAdminAlertMessage("")} className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold">Dispensar aviso</button></div></div></div>}
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
        {allowed && tab === "viaturas" && <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <h2 className="font-bold">Cadastro e gerenciamento de viaturas</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cadastre novos veículos ou desative temporariamente os que não devem aparecer na Central de Despacho. A desativação preserva o histórico.</p>
          </div>
          <form onSubmit={(event) => void addVehicle(event)} className="m-4 flex flex-col gap-3 rounded-xl border border-border bg-background/50 p-4 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 space-y-1 text-sm">
              <span className="font-semibold">Identificação da viatura</span>
              <input required maxLength={40} value={newVehicleName} onChange={(event) => setNewVehicleName(event.target.value)} placeholder="Ex.: VTR-GCM-010 ou GCM MOTO 006" className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
            </label>
            <button type="submit" disabled={savingVehicle || !newVehicleName.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              <Plus className="h-4 w-4" /> {savingVehicle ? "Cadastrando..." : "Cadastrar viatura"}
            </button>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground"><tr><th className="p-3">Viatura</th><th className="p-3">Cadastro</th><th className="p-3">Situação</th><th className="p-3">Ação</th></tr></thead>
              <tbody>
                {vehicles.map((vehicle) => <tr key={vehicle.vehicle} className="border-t border-border">
                  <td className="p-3 font-semibold">{vehicle.vehicle}</td>
                  <td className="p-3">{formatDate(vehicle.created_at)}</td>
                  <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${vehicle.active ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}>{vehicle.active ? "Ativa no CAD" : "Desativada"}</span></td>
                  <td className="p-3"><button type="button" disabled={busyId === vehicle.vehicle} onClick={() => void toggleVehicleActive(vehicle)} className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${vehicle.active ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>{busyId === vehicle.vehicle ? "Salvando..." : vehicle.active ? "Desativar" : "Reativar"}</button></td>
                </tr>)}
                {vehicles.length === 0 && <tr><td colSpan={4} className="p-5 text-center text-sm text-muted-foreground">Nenhuma viatura cadastrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>}
        {allowed && tab === "equipes" && <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <h2 className="font-bold">Cadastro de equipes e integrantes</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cadastre os GCMs e vincule cada integrante à equipe Alpha, Bravo, Charlie ou Delta. Matrículas são únicas. Desativar preserva os registros históricos e remove o integrante das novas seleções do CAD.</p>
          </div>
          <form onSubmit={(event) => void addMember(event)} className="m-4 grid gap-3 rounded-xl border border-border bg-background/50 p-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm"><span className="font-semibold">Nome completo / nome de guerra</span><input required minLength={2} maxLength={160} value={memberForm.nome} onChange={(event) => setMemberForm((current) => ({ ...current, nome: event.target.value }))} placeholder="Ex.: GCM SILVA" className="w-full rounded-lg border border-border bg-background px-3 py-2.5" /></label>
            <label className="space-y-1 text-sm"><span className="font-semibold">Matrícula funcional</span><input required minLength={2} maxLength={30} value={memberForm.matricula} onChange={(event) => setMemberForm((current) => ({ ...current, matricula: event.target.value }))} placeholder="Ex.: RM-1234" className="w-full rounded-lg border border-border bg-background px-3 py-2.5" /></label>
            <label className="space-y-1 text-sm"><span className="font-semibold">Cargo / graduação</span><select required value={memberForm.cargo} onChange={(event) => setMemberForm((current) => ({ ...current, cargo: event.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5"><option value="" disabled>Selecione o cargo / graduação</option>{(["1ª Classe", "2ª Classe", "3ª Classe", "GCM", "Classe Especial", "Classe Distinta", "Comando"] as const).map((cargo) => <option key={cargo} value={cargo}>{cargo}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="font-semibold">Equipe operacional</span><select value={memberForm.equipe} onChange={(event) => setMemberForm((current) => ({ ...current, equipe: event.target.value as AdminMember["equipe"] }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5">{(["Alpha", "Bravo", "Charlie", "Delta"] as const).map((equipe) => <option key={equipe} value={equipe}>{equipe}</option>)}</select></label>
            <div className="flex flex-wrap gap-2 sm:col-span-2"><button type="submit" disabled={savingMember} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{editingMemberId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{savingMember ? "Salvando..." : editingMemberId ? "Salvar alterações" : "Cadastrar GCM"}</button>{editingMemberId && <button type="button" onClick={() => { setEditingMemberId(null); setMemberForm({ nome: "", matricula: "", cargo: "", equipe: "Alpha" }); }} className="rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold">Cancelar edição</button>}</div>
          </form>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-secondary/60 text-xs uppercase text-muted-foreground"><tr><th className="p-3">Integrante</th><th className="p-3">Matrícula</th><th className="p-3">Cargo / graduação</th><th className="p-3">Equipe</th><th className="p-3">Situação</th><th className="p-3">Ação</th></tr></thead><tbody>
            {members.map((member) => <tr key={member.id} className="border-t border-border"><td className="p-3 font-semibold">{member.nome}</td><td className="p-3">{member.matricula}</td><td className="p-3">{member.cargo}</td><td className="p-3"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{member.equipe}</span></td><td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${member.ativo ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}>{member.ativo ? "Ativo no CAD" : "Inativo"}</span></td><td className="p-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setEditingMemberId(member.id); setMemberForm({ nome: member.nome, matricula: member.matricula, cargo: member.cargo, equipe: member.equipe }); setMessage(""); setError(""); }} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"><Pencil className="h-3.5 w-3.5" />Editar</button><button type="button" disabled={busyId === member.id} onClick={() => void toggleMemberActive(member)} className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${member.ativo ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>{busyId === member.id ? "Salvando..." : member.ativo ? "Desativar" : "Reativar"}</button></div></td></tr>)}
            {members.length === 0 && <tr><td colSpan={6} className="p-5 text-center text-sm text-muted-foreground">Nenhum GCM cadastrado. Use o formulário acima para iniciar o cadastro.</td></tr>}
          </tbody></table></div>
        </section>}
        {allowed && tab === "estatisticas" && <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div><h2 className="flex items-center gap-2 text-lg font-bold"><BarChart3 className="h-5 w-5 text-primary" /> Estatísticas operacionais</h2><p className="mt-1 text-sm text-muted-foreground">Consulte registros por período e gere um relatório em PDF. A análise usa somente campos estatísticos, sem dados pessoais dos solicitantes.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="space-y-1 text-sm"><span className="font-semibold">Data inicial</span><input type="date" value={statsStart} max={statsEnd || undefined} onChange={e=>setStatsStart(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" /></label><label className="space-y-1 text-sm"><span className="font-semibold">Data final</span><input type="date" value={statsEnd} min={statsStart || undefined} max={new Date().toISOString().slice(0,10)} onChange={e=>setStatsEnd(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" /></label><button type="button" onClick={()=>void loadOccurrenceStatistics()} disabled={statsLoading || !statsStart || !statsEnd} className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${statsLoading ? "animate-spin" : ""}`} />{statsLoading ? "Consultando..." : "Consultar estatísticas"}</button><button type="button" onClick={printStatisticsReport} disabled={!statsLoaded || statsLoading} className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><FileDown className="h-4 w-4" /> Gerar PDF</button></div>
          {statsLoaded && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[{label:"Categoria",value:statsCategoryFilter,all:"Todas",set:setStatsCategoryFilter,options:[...new Set(statsRows.map(x=>x.categoria||"Não informado"))].sort()},{label:"Status",value:statsStatusFilter,all:"Todos",set:setStatsStatusFilter,options:[...new Set(statsRows.map(x=>x.status||"Não informado"))].sort()},{label:"Prioridade",value:statsPriorityFilter,all:"Todas",set:setStatsPriorityFilter,options:[...new Set(statsRows.map(x=>x.prioridade||"Não informado"))].sort()},{label:"Viatura",value:statsVehicleFilter,all:"Todas",set:setStatsVehicleFilter,options:[...new Set(statsRows.map(x=>x.viatura||"Não informado"))].sort()}].map(filter=><label key={filter.label} className="space-y-1 text-sm"><span className="font-semibold">{filter.label}</span><select value={filter.value} onChange={event=>filter.set(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5"><option>{filter.all}</option>{filter.options.map(option=><option key={option}>{option}</option>)}</select></label>)}
          </div>}
          {statsLoaded && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="space-y-1 text-sm"><span className="font-semibold">Dia da semana</span><select value={statsDayFilter} onChange={event=>setStatsDayFilter(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5"><option value="Todos">Todos</option>{weekdayNames.map((day,index)=><option key={day} value={String(index)}>{day}</option>)}</select></label><label className="space-y-1 text-sm"><span className="font-semibold">Faixa horária</span><select value={statsHourFilter} onChange={event=>setStatsHourFilter(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5"><option value="Todas">Todas</option>{Array.from({length:24},(_,hour)=><option key={hour} value={String(hour)}>{String(hour).padStart(2,"0")}:00–{String((hour+1)%24).padStart(2,"0")}:00</option>)}</select></label></div>}
          {!statsLoaded && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Selecione o período e clique em “Consultar estatísticas”.</div>}
          {statsLoaded && <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{label:"Ocorrências registradas",value:filteredStatsRows.length,icon:ClipboardList},{label:"Encerradas",value:filteredStatsRows.filter(x=>x.status.toLowerCase()==="encerrada").length,icon:CheckCircle2},{label:"Alta prioridade",value:filteredStatsRows.filter(x=>/alta|urgente|alta prioridade/i.test(x.prioridade||"")).length,icon:AlertTriangle},{label:"Viaturas utilizadas",value:new Set(filteredStatsRows.map(x=>x.viatura).filter(Boolean)).size,icon:CarFront}].map(m=><div key={m.label} className="rounded-xl border border-border bg-background/50 p-4"><m.icon className="mb-2 h-5 w-5 text-primary" /><p className="text-2xl font-bold tabular-nums">{m.value}</p><p className="text-sm text-muted-foreground">{m.label}</p></div>)}</div><div className="grid gap-4 lg:grid-cols-2">{([{title:"Ocorrências por mês",key:"month"},{title:"Por categoria",key:"categoria"},{title:"Por status",key:"status"},{title:"Por prioridade",key:"prioridade"},{title:"Por dia da semana",key:"weekday"},{title:"Por faixa horária",key:"hour"}] as const).map(group=>{const counts=new Map<string,number>();filteredStatsRows.forEach(row=>{const label=group.key==="month"?new Date(row.created_at).toLocaleDateString("pt-BR",{month:"short",year:"numeric"}):group.key==="weekday"?weekdayNames[new Date(row.created_at).getDay()]:group.key==="hour"?`${String(new Date(row.created_at).getHours()).padStart(2,"0")}:00–${String((new Date(row.created_at).getHours()+1)%24).padStart(2,"0")}:00`:((row as StatsOccurrence)[group.key]||"Não informado");counts.set(label,(counts.get(label)||0)+1)});const entries=[...counts.entries()].sort((a,b)=>group.key==="month"||group.key==="hour"?a[0].localeCompare(b[0]):group.key==="weekday"?weekdayNames.indexOf(a[0])-weekdayNames.indexOf(b[0]):b[1]-a[1]);const max=Math.max(1,...entries.map(([,n])=>n));return <div key={group.key} className="rounded-xl border border-border p-4"><h3 className="mb-3 font-semibold">{group.title}</h3>{!entries.length?<p className="text-sm text-muted-foreground">Nenhum registro no período.</p>:<div className="space-y-3">{entries.map(([label,count])=><div key={label} className="space-y-1"><div className="flex justify-between gap-3 text-xs"><span className="truncate">{label}</span><span className="font-semibold tabular-nums">{count} ({filteredStatsRows.length?(count*100/filteredStatsRows.length).toLocaleString("pt-BR",{maximumFractionDigits:1}):0}%)</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{width:`${count/max*100}%`}} /></div></div>)}</div>}</div>})}</div><div className="rounded-xl border border-border bg-background/50 p-4"><h3 className="font-semibold">Comparativo com o período anterior</h3><p className="mt-1 text-sm text-muted-foreground">Período de referência com a mesma duração, imediatamente anterior à data inicial selecionada.</p><div className="mt-3 flex flex-wrap items-center gap-3"><span className="text-sm">Atual: <b>{filteredStatsRows.length}</b></span><span className="text-sm">Anterior: <b>{filteredPreviousStatsRows.length}</b></span><span className={`rounded-full px-3 py-1 text-sm font-semibold ${filteredStatsRows.length>filteredPreviousStatsRows.length?"bg-destructive/10 text-destructive":filteredStatsRows.length<filteredPreviousStatsRows.length?"bg-success/10 text-success":"bg-secondary text-muted-foreground"}`}>{filteredPreviousStatsRows.length===0?(filteredStatsRows.length===0?"Sem variação":"Sem base anterior para percentual"):`${filteredStatsRows.length>filteredPreviousStatsRows.length?"+":""}${(((filteredStatsRows.length-filteredPreviousStatsRows.length)/filteredPreviousStatsRows.length)*100).toLocaleString("pt-BR",{maximumFractionDigits:1})}%`}</span></div></div><p className="text-xs text-muted-foreground">Os indicadores refletem os registros do sistema no período consultado e os filtros selecionados.</p></>}
        </section>}
        {allowed && tab === "usuarios" && <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-4"><h2 className="font-bold">Usuários e permissões</h2>{editingProfile && <div className="m-4 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4"><div className="flex items-center justify-between gap-2"><div><h3 className="font-bold">Identificação funcional do operador</h3><p className="text-xs text-muted-foreground">{editingProfile.email}</p></div><button onClick={() => setEditingProfile(null)} className="rounded-lg p-2 hover:bg-secondary" aria-label="Cancelar edição"><X className="h-4 w-4" /></button></div><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>Nome de guerra</span><input value={profileForm.nome_completo} onChange={(e) => setProfileForm((v) => ({ ...v, nome_completo: e.target.value }))} className="w-full rounded-lg border border-border bg-background p-3" placeholder="Ex.: LEDIANO" /></label><label className="space-y-1 text-sm"><span>RM</span><input value={profileForm.matricula} onChange={(e) => setProfileForm((v) => ({ ...v, matricula: e.target.value }))} className="w-full rounded-lg border border-border bg-background p-3" placeholder="Ex.: RM-4963" /></label><label className="space-y-1 text-sm"><span>Posto/graduação</span><input value={profileForm.cargo} onChange={(e) => setProfileForm((v) => ({ ...v, cargo: e.target.value }))} className="w-full rounded-lg border border-border bg-background p-3" placeholder="Ex.: 1ª Classe" /></label><label className="space-y-1 text-sm"><span>Lotação</span><input value={profileForm.lotacao} onChange={(e) => setProfileForm((v) => ({ ...v, lotacao: e.target.value }))} className="w-full rounded-lg border border-border bg-background p-3" placeholder="Ex.: CAD / Central de Despacho" /></label></div><button disabled={busyId === editingProfile.user_id} onClick={() => void saveOperatorProfile()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" /> Salvar identificação funcional</button></div>}<p className="mt-1 text-sm text-muted-foreground">Somente contas aprovadas recebem a função de operador. Bloquear remove a permissão operacional; excluir cadastro remove a conta de autenticação e exige justificativa.</p></div>{selectedUserDeletion && <div className="m-4 space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" /><div><p className="font-semibold">Excluir cadastro de {selectedUserDeletion.email ?? selectedUserDeletion.user_id}</p><p className="text-sm text-muted-foreground">A conta de autenticação será removida. Esta ação é definitiva; confirme que não há necessidade de manter o acesso dessa pessoa.</p></div></div><label className="block space-y-1 text-sm"><span>Justificativa obrigatória</span><textarea value={userDeleteReason} onChange={(event) => setUserDeleteReason(event.target.value)} rows={2} className="w-full rounded-lg border border-border bg-background p-3" placeholder="Informe o motivo da exclusão..." /></label><div className="flex flex-wrap gap-2"><button disabled={busyId === selectedUserDeletion.user_id || userDeleteReason.trim().length < 5} onClick={() => void deleteUserAccount()} className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"><Trash2 className="h-4 w-4" /> Confirmar exclusão</button><button onClick={() => { setSelectedUserDeletion(null); setUserDeleteReason(""); }} className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold">Cancelar</button></div></div>}
          <div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-left text-sm"><thead className="bg-secondary/60 text-xs uppercase text-muted-foreground"><tr><th className="p-3">Operador / identificação funcional</th><th className="p-3">Matrícula</th><th className="p-3">Cargo / lotação</th><th className="p-3">Cadastro</th><th className="p-3">Último acesso</th><th className="p-3">Situação</th><th className="p-3">Ação</th></tr></thead><tbody>{users.map((user) => <tr key={user.user_id} className="border-t border-border"><td className="p-3"><p className="font-semibold">{user.nome_completo || "Perfil não preenchido"}</p><p className="mt-1 text-xs text-muted-foreground">{user.email ?? "E-mail indisponível"}</p><p className="mt-1 max-w-56 truncate text-[10px] text-muted-foreground">{user.user_id}</p></td><td className="p-3">{user.matricula || "—"}</td><td className="p-3"><p>{user.cargo || "—"}</p><p className="text-xs text-muted-foreground">{user.lotacao || "—"}</p></td><td className="p-3">{formatDate(user.created_at)}</td><td className="p-3">{formatDate(user.last_sign_in_at)}</td><td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.role === "admin" ? "bg-primary/15 text-primary" : user.role === "operador" ? "bg-success/10 text-success" : "bg-amber-500/10 text-amber-500"}`}>{user.role === "admin" ? "Administrador" : user.role === "operador" ? "Operador liberado" : "Pendente / sem acesso"}</span></td><td className="p-3">{user.role === "admin" ? <span className="text-xs text-muted-foreground">Conta protegida</span> : <div className="flex flex-col items-start gap-2"><button disabled={busyId === user.user_id} onClick={() => { setEditingProfile(user); setProfileForm({ nome_completo: user.nome_completo ?? "", matricula: user.matricula ?? "", cargo: user.cargo ?? "", lotacao: user.lotacao ?? "" }); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"><Pencil className="h-3.5 w-3.5" /> Dados funcionais</button><button disabled={busyId === user.user_id} onClick={() => void setOperatorAccess(user, user.role !== "operador")} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${user.role === "operador" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>{user.role === "operador" ? <><Ban className="h-3.5 w-3.5" /> Bloquear</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Liberar acesso</>}</button><button disabled={busyId === user.user_id} onClick={() => { setSelectedUserDeletion(user); setUserDeleteReason(""); }} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Excluir cadastro</button></div>}</td></tr>)}</tbody></table></div>
        </section>}
        {allowed && tab === "ocorrencias" && <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-4"><h2 className="font-bold">Gestão de ocorrências</h2><p className="mt-1 text-sm text-muted-foreground">A exclusão é definitiva, exige justificativa e fica registrada na auditoria administrativa. Prefira manter a ocorrência e alterar seu status quando possível.</p></div>
          <form onSubmit={(event) => void searchOccurrencesByProtocol(event)} className="m-4 space-y-2 rounded-xl border border-border bg-background/50 p-3">
            <label htmlFor="admin-protocol-search" className="block text-sm font-semibold">Buscar ocorrência por protocolo</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input id="admin-protocol-search" value={protocolSearch} onChange={(event) => setProtocolSearch(event.target.value)} placeholder="Ex.: GCM-2026-649200 ou 649200" autoComplete="off" className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <button type="submit" disabled={searchingProtocol || protocolSearch.trim().length < 3} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><Search className="h-4 w-4" />{searchingProtocol ? "Pesquisando..." : "Buscar"}</button>
              {protocolSearchActive && <button type="button" onClick={() => void clearProtocolSearch()} disabled={searchingProtocol} className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><X className="h-4 w-4" /> Limpar</button>}
            </div>
            <p className="text-xs text-muted-foreground">{protocolSearchActive ? `Exibindo resultados para “${protocolSearch.trim()}”.` : "Pesquise pelo protocolo completo ou por parte dele. São aceitos pelo menos 3 caracteres."}</p>
          </form>
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
              <div><h3 className="mb-2 font-semibold">Descrição da ocorrência</h3><p className="whitespace-pre-wrap break-words rounded-lg border border-border p-4 text-sm">{parseOccurrenceMetadata(viewingOccurrence.descricao).cleanDescription || "Sem descrição registrada."}</p></div>
              {(() => { const triage = parseOccurrenceMetadata(viewingOccurrence.descricao); return (triage.aggressor || triage.measure || triage.attachmentPath || triage.attachmentFailed) ? <section className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"><h3 className="font-semibold">Informações da triagem de violência doméstica</h3>{triage.aggressor && <p className="text-sm"><span className="font-medium">Agressor, ameaça ou aproximação:</span> {triage.aggressor}</p>}{triage.measure && <p className="text-sm"><span className="font-medium">Medida protetiva:</span> {triage.measure}</p>}{triage.attachmentPath && <p className="text-sm text-success">Documento da medida protetiva anexado.</p>}{triage.attachmentFailed && <p className="text-sm font-semibold text-destructive">Atenção: o documento não foi recebido. O atendimento não deve ser condicionado ao envio do arquivo.</p>}</section> : null; })()}
              <div><h3 className="mb-2 font-semibold">Providências e observações</h3><p className="whitespace-pre-wrap break-words rounded-lg border border-border p-4 text-sm">{viewingOccurrence.observacao || "Nenhuma observação registrada."}</p></div>
              <div><h3 className="mb-2 font-semibold">Histórico operacional</h3>{occurrenceHistory.length ? <div className="space-y-2">{occurrenceHistory.map((item) => <article key={item.id} className="rounded-lg border border-border p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{item.acao}</p><time className="text-xs text-muted-foreground">{formatDate(item.criado_em)}</time></div><p className="mt-1 text-xs text-muted-foreground">Status: {item.status_anterior || "—"} → {item.status_novo || "—"} · Viatura: {item.viatura || "—"}</p>{(() => { const marker = "[OPERADOR_FUNCIONAL: "; const markerEnd = item.observacao?.indexOf("]") ?? -1; const operador = item.observacao?.startsWith(marker) && markerEnd > marker.length ? item.observacao.slice(marker.length, markerEnd) : item.operador_id; const observacao = item.observacao?.startsWith(marker) && markerEnd >= 0 ? item.observacao.slice(markerEnd + 1).trim() : item.observacao; return <><p className="mt-1 text-xs text-muted-foreground">Operador responsável: {operador}</p>{observacao && <p className="mt-2 whitespace-pre-wrap text-sm">{observacao.replace(/^EV:/gm, "Encarregado:")}</p>}</>; })()}</article>)}</div> : <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">Nenhum histórico operacional disponível.</p>}</div>
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setSelectedAudit(entry)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"><Eye className="h-3.5 w-3.5" /> Visualizar relatório</button>
                  <button type="button" onClick={() => printAuditReport(entry)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><FileDown className="h-3.5 w-3.5" /> Imprimir / Salvar PDF</button>
                </div>
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
        {allowed && selectedAudit && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title">
          <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border p-5"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Auditoria administrativa</p><h2 id="audit-detail-title" className="mt-1 text-xl font-bold">{getAuditAction(selectedAudit.action).title}</h2><p className="mt-1 text-sm text-muted-foreground">{formatDate(selectedAudit.created_at)}</p></div><button type="button" onClick={() => setSelectedAudit(null)} className="rounded-lg border border-border p-2" aria-label="Fechar detalhes"><X className="h-4 w-4" /></button></div>
            <div className="space-y-5 p-5"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Categoria</p><p className="mt-1 font-semibold">{getAuditAction(selectedAudit.action).category}</p></div><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Responsável</p><p className="mt-1 break-all font-semibold">{selectedAudit.actor_email || "Não identificado"}</p></div></div>
              <div><h3 className="mb-2 font-semibold">Detalhes registrados</h3>{auditDetails(selectedAudit.details).length ? <dl className="grid gap-2 sm:grid-cols-2">{auditDetails(selectedAudit.details).map((detail) => <div key={detail.key} className="rounded-lg border border-border p-3"><dt className="text-xs text-muted-foreground">{detail.label}</dt><dd className="mt-1 break-words text-sm font-medium">{detail.value}</dd></div>)}</dl> : <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">Este evento não possui detalhes adicionais registrados.</p>}</div>
              <div><h3 className="mb-2 font-semibold">Detalhes técnicos e identificadores</h3><dl className="grid gap-2 rounded-xl bg-secondary/40 p-3 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">ID do evento</dt><dd className="break-all text-sm">{selectedAudit.id}</dd></div><div><dt className="text-xs text-muted-foreground">Ação técnica</dt><dd className="break-all text-sm">{selectedAudit.action}</dd></div>{selectedAudit.target_user_id && <div><dt className="text-xs text-muted-foreground">ID da conta afetada</dt><dd className="break-all text-sm">{selectedAudit.target_user_id}</dd></div>}{selectedAudit.occurrence_id && <div><dt className="text-xs text-muted-foreground">ID da ocorrência</dt><dd className="break-all text-sm">{selectedAudit.occurrence_id}</dd></div>}</dl></div>
              <p className="text-xs text-muted-foreground">Esta visualização não permite alterar nem excluir o evento original.</p></div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border p-4"><button type="button" onClick={() => setSelectedAudit(null)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">Fechar</button><button type="button" onClick={() => printAuditReport(selectedAudit)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><FileDown className="h-4 w-4" /> Imprimir / Salvar PDF</button></div>
          </section>
        </div>}

        <p className="mt-5 text-xs text-muted-foreground">A interface não armazena senhas. Todas as ações privilegiadas são verificadas no banco e registradas na auditoria.</p>
      </div>
    </main>
  );
}
