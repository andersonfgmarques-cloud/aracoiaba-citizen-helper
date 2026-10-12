import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Phone, RotateCcw, Send, AlertTriangle, CheckCircle2, LayoutDashboard, Mic, MicOff, Paperclip } from "lucide-react";
import { TREE, CONTACTS, type Contact } from "@/lib/triage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GCM Araçoiaba da Serra – Atendimento ao Cidadão" },
      {
        name: "description",
        content: "Assistente de triagem da Guarda Civil Municipal de Araçoiaba da Serra – SP.",
      },
      { property: "og:title", content: "GCM Araçoiaba da Serra – Atendimento" },
      {
        property: "og:description",
        content: "Solicite a GCM e saiba qual órgão acionar em cada situação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Msg =
  | { from: "bot"; text: string; contacts?: Contact[]; urgent?: boolean; digitalDelegacia?: boolean }
  | { from: "user"; text: string }
  | { from: "done"; protocol: string; category: string };

type SpeechRecognitionResultLike = { transcript: string; isFinal: boolean };
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

const FIELDS = [
  { key: "nome", q: "Qual o seu nome completo?" },
  { key: "cpf", q: "Informe o seu CPF (somente números)." },
  { key: "endereco_solicitante", q: "Qual o endereço da sua residência? (rua, número e bairro)" },
  { key: "telefone", q: "Telefone para contato?" },
  { key: "endereco", q: "Qual o endereço COMPLETO da ocorrência? (rua, número e bairro)" },
  { key: "descricao", q: "Descreva rapidamente o que está acontecendo." },
] as const;

const fieldsForCategory = (category: string) => {
  if (category !== "Violência doméstica" && category !== "Descumprimento de medida protetiva de urgência") return FIELDS;
  return [
    ...FIELDS.slice(0, 5),
    { key: "agressor_local", q: "O possível agressor está no local, tentando entrar em contato ou se aproximar? Informe também se há ameaça ou agressão em andamento." },
    { key: "medida_protetiva", q: "Existe medida protetiva de urgência? Informe se está vigente, se houve descumprimento e quais restrições foram violadas. Se não souber, informe isso." },
    FIELDS[5],
  ] as const;
};

function validaCpf(c: string) {
  // Validação de formato: exige exatamente 11 dígitos numéricos.
  // Não rejeita o CPF com base nos dígitos verificadores.
  return /^\d{11}$/.test(c);
}

function validaEndereco(e: string) {
  const t = e.replace(/\s+/g, " ").trim();
  if (t.length < 12 || t.split(" ").length < 3) return false;
  if (!/\d/.test(t)) return false; // exige número (ex.: "Rua das Flores, 123")
  if (!/[a-zA-Zà-úÀ-Ú]{3,}/.test(t)) return false; // exige nome de via/bairro
  return true;
}

function Index() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [node, setNode] = useState("start");
  const [form, setForm] = useState<{
    category: string;
    step: number;
    data: Record<string, string>;
  } | null>(null);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceBaseInputRef = useRef("");
  const speechReceivedRef = useRef(false);
  const speechFailedRef = useRef(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const [preData, setPreData] = useState({ nome: "", cpf: "", endereco_solicitante: "" });
  const [preStep, setPreStep] = useState<0 | 1 | 2>(0);
  const [ciencia, setCiencia] = useState<"termo" | "veracidade" | "aceita" | "recusada">("termo");
  const [termoAceitoEm, setTermoAceitoEm] = useState<string | null>(null);
  const [veracidadeAceitaEm, setVeracidadeAceitaEm] = useState<string | null>(null);
  const [contatoSelecionado, setContatoSelecionado] = useState<string | null>(null);
  const [medidaFile, setMedidaFile] = useState<File | null>(null);
  const [uploadingMedida, setUploadingMedida] = useState(false);
  const [medidaFile, setMedidaFile] = useState<File | null>(null);
  const [uploadingMedida, setUploadingMedida] = useState(false);
  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognitionConstructor =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setSpeechError("Seu navegador não oferece ditado por voz. Tente usar o Chrome ou Edge atualizado.");
      return;
    }

    setSpeechError("");
    voiceBaseInputRef.current = input.trimEnd();
    speechReceivedRef.current = false;
    speechFailedRef.current = false;

    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    // Mostra o texto provisório enquanto a pessoa fala, sem duplicar palavras.
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(
        event.results,
        (result) => result[0]?.transcript.trim() ?? "",
      )
        .filter(Boolean)
        .join(" ");

      if (transcript) {
        speechReceivedRef.current = true;
        setSpeechError("");
        setInput([voiceBaseInputRef.current, transcript].filter(Boolean).join(" "));
      }
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      speechFailedRef.current = true;
      const messages: Record<string, string> = {
        "not-allowed": "Acesso ao microfone bloqueado. Clique no cadeado ao lado do endereço do site e permita o uso do microfone.",
        "service-not-allowed": "O navegador bloqueou o serviço de reconhecimento de voz. Verifique as permissões do Edge e tente novamente.",
        "audio-capture": "Nenhum microfone foi detectado. Confira se o microfone do fone está selecionado como entrada no Windows.",
        "no-speech": "Nenhuma fala foi detectada. Confira se o microfone do fone está selecionado no Windows e tente falar novamente.",
        network: "O reconhecimento de voz não conseguiu se conectar ao serviço. Verifique a conexão com a internet.",
        "language-not-supported": "O reconhecimento de voz em português não está disponível neste navegador.",
        aborted: "Ditado interrompido.",
      };
      setSpeechError(messages[event.error ?? ""] ?? `Falha no reconhecimento de voz (${event.error ?? "erro desconhecido"}). Confira o microfone e tente novamente.`);
    };
    recognition.onend = () => {
      setIsListening(false);
      if (!speechReceivedRef.current && !speechFailedRef.current) {
        setSpeechError("Não recebi nenhuma transcrição. No Windows, selecione o microfone do fone como entrada padrão e confira a permissão de microfone do Edge.");
      }
    };
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      setSpeechError("Não foi possível iniciar o microfone. Verifique a permissão do site no navegador e tente novamente.");
    }
  };
  const aceitarTermo = () => {
    setTermoAceitoEm(new Date().toISOString());
    setCiencia("veracidade");
  };
  const aceitarVeracidade = () => {
    setVeracidadeAceitaEm(new Date().toISOString());
    setCiencia("aceita");
    setMsgs([]);
    setForm(null);
    setNode("start");
  };

  const say = (key: string) => {
    const n = TREE[key]!;
    setNode(key);
    if (n.kind === "route")
      setMsgs((m) => [
        ...m,
        { from: "bot", text: n.text, contacts: n.contacts, urgent: !!n.urgent, digitalDelegacia: key === "r_civil" || key === "r_transito_sem_vitima" },
      ]);
    else if (n.kind === "ask") setMsgs((m) => [...m, { from: "bot", text: n.text }]);
    else {
      setForm({ category: n.category, step: 0, data: {} });
      setMsgs((m) => [
        ...m,
        { from: "bot", text: n.text, contacts: n.contacts, urgent: !!n.urgent },
        { from: "bot", text: fieldsForCategory(n.category)[0]!.q },
      ]);
    }
  };

  useEffect(() => {
    if (ciencia === "aceita" && msgs.length === 0) say("start");
  }, [ciencia, msgs.length]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const reset = () => {
    setMsgs([]);
    setForm(null);
    setPreData({ nome: "", cpf: "", endereco_solicitante: "" });
    setPreStep(0);
    setCiencia("termo");
    setTermoAceitoEm(null);
    setVeracidadeAceitaEm(null);
    setNode("start");
    setInput("");
    setMedidaFile(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !input.trim()) return;
    const activeFields = fieldsForCategory(form.category);
    const f = activeFields[form.step]!;
    let value = input.trim();
    if ((f.key as string) === "cpf") {
      const d = value.replace(/\D/g, "");
      if (!validaCpf(d)) {
        setMsgs((m) => [
          ...m,
          { from: "user", text: value },
          { from: "bot", text: "CPF inválido. Digite os 11 números do seu CPF." },
        ]);
        setInput("");
        return;
      }
      value = d;
    }
    if (f.key === "endereco" || f.key === "endereco_solicitante") {
      if (!validaEndereco(value)) {
        setMsgs((m) => [
          ...m,
          { from: "user", text: value },
          {
            from: "bot",
            text: "Endereço incompleto. Informe rua, número e bairro — por exemplo: Rua das Flores, 123, Jardim Primavera.",
          },
        ]);
        setInput("");
        return;
      }
    }
    const data = { ...form.data, [f.key]: value };
    setInput("");
    const next = form.step + 1;
    if (next < activeFields.length) {
      setForm({ ...form, step: next, data });
      setMsgs((m) => [...m, { from: "user", text: value }, { from: "bot", text: activeFields[next]!.q }]);
    } else {
      const protocol = `GCM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const prioridade = ["Atitude suspeita", "Perturbação do sossego", "Violência doméstica", "Descumprimento de medida protetiva de urgência"].includes(form.category)
        ? "alta"
        : "media";
      let anexoPath: string | null = null;
      if (medidaFile) {
        setUploadingMedida(true);
        const safeName = medidaFile.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
        const { data: uploaded, error: uploadError } = await supabase.storage
          .from("gcm-medidas-protetivas")
          .upload(`${protocol}/${Date.now()}-${safeName}`, medidaFile, { contentType: medidaFile.type, upsert: false });
        setUploadingMedida(false);
        if (uploadError) {
          setMsgs((m) => [...m, { from: "bot", text: "Não foi possível anexar o arquivo. Remova o anexo para registrar a solicitação sem documento ou tente novamente." }]);
          return;
        }
        anexoPath = uploaded.path;
      }
      const dadosTriagem = [
        data["agressor_local"] ? `\n\n[TRIAGEM_VIOLENCIA_DOMESTICA: POSSIVEL_AGRESSOR=${data["agressor_local"]}]` : "",
        data["medida_protetiva"] ? `\n[TRIAGEM_MEDIDA_PROTETIVA: ${data["medida_protetiva"]}]` : "",
        anexoPath ? `\n[ANEXO_MEDIDA_PROTETIVA: path=${anexoPath}]` : "",
      ].join("");
      const payload = {
        protocolo: protocol,
        categoria: form.category,
        prioridade,
        nome: data["nome"]!,
        cpf: data["cpf"]!,
        endereco_solicitante: data["endereco_solicitante"]!,
        telefone: data["telefone"]!,
        endereco: data["endereco"]!,
        descricao: `${data["descricao"]!}${dadosTriagem}\n\n[REGISTRO_TERMO_ART340: ACEITO_EM=${termoAceitoEm ?? new Date().toISOString()}]\n[REGISTRO_TERMO_VERACIDADE: VERSAO=1; ACEITO_EM=${veracidadeAceitaEm ?? new Date().toISOString()}]`,
      };
      // Envio obrigatório ao CAD: até 3 tentativas antes de informar falha
      let insertError: { message: string } | null = null;
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const { error } = await supabase.from("ocorrencias").insert(payload);
        insertError = error;
        if (!error) break;
        await new Promise((r) => setTimeout(r, 1000 * (tentativa + 1)));
      }
      if (insertError) {
        setMsgs((m) => [
          ...m,
          { from: "user", text: value },
          {
            from: "bot",
            text: `Não foi possível registrar a solicitação no sistema: ${insertError.message}. Nenhuma confirmação de registro foi emitida. Em caso de urgência, ligue 153.`,
            urgent: true,
          },
        ]);
        return;
      }
      setForm(null);
      setMedidaFile(null);
      setNode("__done");
      setMsgs((m) => [
        ...m,
        { from: "user", text: input.trim() },
        { from: "done", protocol, category: form.category },
      ]);
    }
  };

  const current = TREE[node];

  if (ciencia !== "aceita") {
    const preLabels = [
      { key: "nome", label: "Nome completo", placeholder: "Digite seu nome completo" },
      { key: "cpf", label: "CPF", placeholder: "Digite seu CPF" },
      { key: "endereco_solicitante", label: "Endereço", placeholder: "Rua, número e bairro" },
    ] as const;
    const field = preLabels[preStep];

    if (ciencia === "recusada") {
      return (
        <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background">
          <header className="bg-header flex items-center gap-3 border-b px-4 py-4 shadow-lg">
            <img src={`/aracoiaba-citizen-helper/android-chrome-192x192.png`} alt="Emblema da Guarda Civil Municipal" className="h-11 w-11 shrink-0 rounded-full object-contain" />
            <div className="min-w-0 flex-1"><h1 className="text-base font-bold">GCM Araçoiaba da Serra</h1><p className="text-xs text-muted-foreground">Atendimento ao cidadão</p></div>
            <Link to="/operador" aria-label="Acessar painel CAD do operador" title="Acesso do operador CAD" className="gcm-cad-link flex shrink-0 items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20">
              <LayoutDashboard className="h-4 w-4" /> CAD
            </Link>
          </header>
          <main className="flex flex-1 items-center px-4 py-6">
            <div className="w-full rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="text-lg font-bold text-destructive">Solicitação encerrada</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Você recusou um dos termos obrigatórios. O atendimento foi encerrado.
              </p>
              <button onClick={() => { setPreData({ nome: "", cpf: "", endereco_solicitante: "" }); setPreStep(0); setCiencia("termo"); }}
                className="mt-5 w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground">
                Iniciar novamente
              </button>
            </div>
          </main>
        </div>
      );
    }

    if (false as boolean) {
      return (
        <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background">
          <header className="bg-header flex items-center gap-3 border-b px-4 py-4 shadow-lg">
            <img src={`/aracoiaba-citizen-helper/android-chrome-192x192.png`} alt="Emblema da Guarda Civil Municipal" className="h-11 w-11 shrink-0 rounded-full object-contain" />
            <div className="min-w-0 flex-1"><h1 className="text-base font-bold">GCM Araçoiaba da Serra</h1><p className="text-xs text-muted-foreground">Atendimento ao cidadão</p></div>
            <Link to="/operador" aria-label="Acessar painel CAD do operador" title="Acesso do operador CAD" className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20">
              <LayoutDashboard className="h-4 w-4" /> CAD
            </Link>
          </header>
          <main className="flex flex-1 items-center px-4 py-6">
            <form onSubmit={(e) => {
              e.preventDefault();
              const value = preData[field.key].trim();
              if (!value) return;
              if (field.key === "cpf" && !validaCpf(value.replace(/\D/g, ""))) return;
              if (field.key === "endereco_solicitante" && !validaEndereco(value)) return;
              setPreData({ ...preData, [field.key]: field.key === "cpf" ? value.replace(/\D/g, "") : value });
              if (preStep < 2) setPreStep((preStep + 1) as 0 | 1 | 2);
              else iniciarServico();
            }} className="w-full rounded-2xl border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase text-primary">Identificação do solicitante • {preStep + 1}/3</p>
              <h2 className="mt-2 text-lg font-bold">{field.label}</h2>
              <p className="mt-2 text-sm text-muted-foreground">Informe seus dados para iniciar o atendimento.</p>
              <input autoFocus value={preData[field.key]} onChange={(e) => setPreData({ ...preData, [field.key]: e.target.value })}
                placeholder={field.placeholder} className="mt-5 w-full rounded-xl border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <button className="mt-4 w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground">
                {preStep < 2 ? "Continuar" : "Continuar para o Termo de Ciência"}
              </button>
            </form>
          </main>
        </div>
      );
    }

    if (ciencia === "veracidade") {
      return (
        <div className="gcm-term-shell mx-auto flex min-h-screen w-full flex-col">
          <header className="gcm-term-header bg-header flex items-center gap-3 border-b px-4 py-4 shadow-lg"><img src="/aracoiaba-citizen-helper/android-chrome-192x192.png" alt="Emblema da Guarda Civil Municipal" className="h-11 w-11 shrink-0 rounded-full object-contain" /><div className="min-w-0 flex-1"><h1 className="text-base font-bold">GCM Araçoiaba da Serra</h1><p className="text-xs text-muted-foreground">Atendimento ao cidadão</p></div><span className="rounded-full border border-primary/50 px-3 py-1 text-xs font-semibold text-primary">2 de 2</span></header>
          <main className="gcm-term-main flex flex-1 items-center"><div className="gcm-term-card w-full rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-bold">Declaração de Veracidade das Informações</h2><div className="mt-4 space-y-3 text-sm leading-relaxed">
              <p>Declaro, para os devidos fins, que as informações prestadas e os documentos apresentados neste atendimento são verdadeiros e correspondem à realidade, assumindo responsabilidade pela veracidade dos dados informados.</p>
              <p>Estou ciente de que a apresentação de informações falsas ou a inserção de declarações inverídicas em documentos poderá acarretar responsabilização civil, administrativa e/ou criminal, conforme a legislação aplicável, especialmente o artigo 299 do Código Penal Brasileiro, quando presentes os requisitos legais para sua configuração.</p>
              <p>Declaro, ainda, estar ciente de que o fornecimento de informações corretas é essencial para o adequado registro, análise e encaminhamento da solicitação à Guarda Civil Municipal.</p>
              <p className="gcm-term-note font-semibold">Ao marcar a opção de aceite, confirmo que li, compreendi e concordo com os termos desta declaração, estando ciente de que o aceite é obrigatório para prosseguir com o atendimento eletrônico.</p>
            </div><div className="mt-5 grid gap-2"><button onClick={aceitarVeracidade} className="gcm-accept-button w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground">Li e concordo — Prosseguir</button><button onClick={() => setCiencia("recusada")} className="gcm-refuse-button w-full rounded-full border border-destructive/60 py-3 font-semibold text-destructive">Recuso-me a aceitar a declaração</button></div>
          </div></main>
        </div>
      );
    }

    return (
      <div className="gcm-term-shell mx-auto flex min-h-screen w-full flex-col">
        <header className="gcm-term-header bg-header flex items-center gap-3 border-b px-4 py-4 shadow-lg">

          <img src={`/aracoiaba-citizen-helper/android-chrome-192x192.png`} alt="Emblema da Guarda Civil Municipal" className="h-11 w-11 shrink-0 rounded-full object-contain" />
          <div className="min-w-0 flex-1"><h1 className="text-base font-bold">GCM Araçoiaba da Serra</h1><p className="text-xs text-muted-foreground">Atendimento ao cidadão</p></div>
            <Link to="/operador" aria-label="Acessar painel CAD do operador" title="Acesso do operador CAD" className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20">
              <LayoutDashboard className="h-4 w-4" /> CAD
            </Link>
        </header>
        <main className="gcm-term-main flex flex-1 items-center">
          <div className="gcm-term-card w-full rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-bold">Termo de Ciência — Comunicação falsa de crime ou de contravenção</h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed">
              <p>O art. 340 do Código Penal estabelece:</p>
              <div className="gcm-law-panel rounded-xl bg-secondary p-4">
                <p className="font-medium">“Provocar a ação de autoridade, comunicando-lhe a ocorrência de crime ou de contravenção que sabe não se ter verificado.”</p>
                <p className="mt-2 font-semibold">Pena: detenção, de 1 (um) a 6 (seis) meses, ou multa.</p>
              </div>
              <p>Ao prosseguir, você declara ciência de que as informações fornecidas devem corresponder aos fatos que está comunicando.</p>
              <p className="gcm-term-note font-semibold">A aceitação deste termo é obrigatória para continuar utilizando o serviço.</p>
            </div>
            <div className="mt-5 grid gap-2">
              <button onClick={aceitarTermo} className="gcm-accept-button w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground">Li e estou ciente — Continuar</button>
              <button onClick={() => setCiencia("recusada")} className="gcm-refuse-button w-full rounded-full border border-destructive/60 py-3 font-semibold text-destructive">Recuso-me a tomar ciência</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-screen max-w-lg flex-col">
      <header className="bg-header flex items-center gap-3 border-b px-4 py-4 shadow-lg">
        <img
          src={`/aracoiaba-citizen-helper/android-chrome-192x192.png`}
          alt="Emblema da Guarda Civil Municipal"
          className="h-11 w-11 shrink-0 rounded-full object-contain"
        />
        <div className="flex-1">
          <h1 className="text-base font-bold leading-tight">GCM Araçoiaba da Serra</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success" /> Assistente de atendimento online
          </p>
        </div>
        <Link
          to="/operador"
          aria-label="Acessar painel CAD do operador"
          title="Acesso do operador CAD"
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
        >
          <LayoutDashboard className="h-4 w-4" />
          CAD
        </Link>
        <button
          onClick={reset}
          aria-label="Reiniciar"
          className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-white/10 bg-slate-950/35 px-3 py-2.5">
        {[
          { id: "gcm", label: "GCM", number: "153" },
          { id: "policia", label: "Polícia", number: "190" },
          { id: "samu", label: "SAMU", number: "" },
          { id: "bombeiros", label: "Corpo", number: "193" },
          { id: "defesa", label: "Defesa", number: "199" },
          { id: "denuncia", label: "Disque", number: "181" },
          { id: "depa", label: "DEPA", number: "Animal" },
        ].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setContatoSelecionado((atual) => atual === c.id ? null : c.id)}
            aria-expanded={contatoSelecionado === c.id}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${contatoSelecionado === c.id ? "border-primary bg-primary text-primary-foreground shadow-[0_0_14px_rgba(245,194,59,0.18)]" : "border-white/10 bg-slate-800/85 text-slate-100 hover:border-primary/50"}`}
          >
            {c.label} {c.number && <span className={contatoSelecionado === c.id ? "text-primary-foreground" : "text-primary"}>{c.number}</span>}
          </button>
        ))}
      </div>
      {contatoSelecionado && (
        <div className="mx-4 mt-3 rounded-xl border bg-card p-4 text-sm shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-bold">
              {({
                gcm: "Guarda Civil Municipal — GCM",
                policia: "Polícia Militar",
                samu: "SAMU",
                bombeiros: "Corpo de Bombeiros",
                defesa: "Defesa Civil",
                denuncia: "Disque Denúncia",
                depa: "DEPA — Delegacia Eletrônica de Proteção Animal",
              } as Record<string, string>)[contatoSelecionado]}
            </h2>
            <button type="button" onClick={() => setContatoSelecionado(null)} className="rounded-full px-2 py-1 text-muted-foreground hover:bg-secondary" aria-label="Fechar contatos">✕</button>
          </div>
          {contatoSelecionado === "gcm" && (
            <div className="flex flex-col gap-2">
              <a className="text-primary underline" href="tel:+551532811012">(15) 3281-1012</a>
              <a className="text-primary underline" href="tel:+5515996565054">(15) 99656-5054</a>
              <a className="text-primary underline" href="tel:153">153</a>
            </div>
          )}
          {contatoSelecionado === "policia" && <a className="text-primary underline" href="tel:190">190 — Polícia Militar</a>}
          {contatoSelecionado === "samu" && (
            <div className="space-y-2">
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-3 font-semibold text-white" style={{ backgroundColor: "#dc2626", color: "#ffffff" }}
                aria-label="SAMU municipal"
              >
                <Phone className="h-4 w-4" /> SAMU
              </div>
              <a
                href="tel:08000135117"
                className="flex items-center justify-between rounded-xl border border-primary/40 bg-secondary px-3 py-2.5 font-semibold"
              >
                <span>Telefone adicional</span>
                <span>0800 013 5117</span>
              </a>
              <a
                href="https://wa.me/5515997673839"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-primary/40 bg-secondary px-3 py-2.5 font-semibold"
              >
                <span>WhatsApp</span>
                <span>(15) 99767-3839</span>
              </a>
            </div>
          )}
          {contatoSelecionado === "bombeiros" && <a className="text-primary underline" href="tel:193">193 — Corpo de Bombeiros</a>}
          {contatoSelecionado === "defesa" && (
            <div className="flex flex-col gap-2">
              <a className="text-primary underline" href="tel:+551532814041">(15) 3281-4041</a>
              <a className="text-primary underline" href="https://wa.me/5515981090984" target="_blank" rel="noreferrer">WhatsApp: (15) 98109-0984</a>
              <a className="text-primary underline" href="tel:199">199 — Defesa Civil</a>
            </div>
          )}
          {contatoSelecionado === "denuncia" && <a className="text-primary underline" href="tel:181">181 — Disque Denúncia</a>}
          {contatoSelecionado === "depa" && (
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground">Registre denúncia de maus-tratos e outros crimes contra animais pela Delegacia Eletrônica de Proteção Animal de São Paulo.</p>
              <a className="font-semibold text-primary underline" href="https://www.webdenuncia.sp.gov.br/depa/captcha" target="_blank" rel="noreferrer">Abrir DEPA — SSP/SP</a>
            </div>
          )}
        </div>
      )}

      <main className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {msgs.map((m, i) =>
          m.from === "user" ? (
            <div
              key={i}
              className="bubble-in ml-auto min-w-0 max-w-[80%] break-words rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-sm text-accent-foreground [overflow-wrap:anywhere]"
            >
              {m.text}
            </div>
          ) : m.from === "done" ? (
            <div key={i} className="bubble-in rounded-2xl border border-success/40 bg-card p-4">
              <div className="flex items-center gap-2 font-bold text-success">
                <CheckCircle2 className="h-5 w-5" /> Solicitação registrada
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Categoria: {m.category}</p>
              <p className="mt-1 font-display text-xl font-bold text-primary">{m.protocol}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Sua solicitação foi registrada com sucesso. O atendimento será avaliado e
                encaminhado conforme o grau de prioridade da ocorrência, considerando a urgência dos
                fatos e a disponibilidade operacional das equipes. Em situações de emergência ou
                agravamento da ocorrência, entre imediatamente em contato pelo telefone{" "}
                <a
                  href="tel:153"
                  className="font-semibold text-primary underline underline-offset-2"
                >
                  153
                </a>
                .
              </p>
            </div>
          ) : (
            <div
              key={i}
              className={`bubble-in min-w-0 max-w-[88%] break-words rounded-2xl rounded-bl-sm px-4 py-3 text-sm [overflow-wrap:anywhere] ${m.urgent ? "border border-destructive/60 bg-destructive/15" : "bg-card"}`}
            >
              {m.urgent && (
                <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Urgente
                </div>
              )}
              <p className="leading-relaxed">{m.text}</p>
              {m.digitalDelegacia && (
                <div className="mt-3 rounded-xl border border-primary/40 bg-secondary p-3">
                  <p className="mb-2 font-semibold">Delegacia Digital — Polícia Civil do Estado de São Paulo</p>
                  <p className="mb-2 text-sm">Você também pode registrar o boletim de ocorrência online, por conta própria, pelo portal oficial:</p>
                  <a
                    href="https://delegaciadigital.policia-civil.sp.gov.br/pagina-inicial"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-primary underline underline-offset-2"
                  >
                    Abrir Delegacia Digital — SSP/SP
                  </a>
                </div>
              )}
              {m.contacts && (
                <div className="mt-3 space-y-2">
                  {m.contacts.map((c) =>
                    c.name === "SAMU" ? (
                      <div key={c.name} className="space-y-2">
                        <div
                          className="flex items-center gap-2 rounded-xl px-3 py-3 font-semibold text-white"
                          style={{ backgroundColor: "#dc2626", color: "#ffffff" }}
                          aria-label="SAMU municipal"
                        >
                          <Phone className="h-4 w-4" /> SAMU
                        </div>
                        <a
                          href="tel:08000135117"
                          className="flex items-center justify-between rounded-xl border border-primary/40 bg-secondary px-3 py-2.5 font-semibold"
                        >
                          <span>Telefone adicional</span>
                          <span>0800 013 5117</span>
                        </a>
                        <a
                          href="https://wa.me/5515997673839"
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-xl border border-primary/40 bg-secondary px-3 py-2.5 font-semibold"
                        >
                          <span>WhatsApp</span>
                          <span>(15) 99767-3839</span>
                        </a>
                      </div>
                    ) : c.name === "Defesa Civil" ? (
                      <div key={c.name} className="space-y-2">
                        <a
                          href="tel:199"
                          className={`flex items-center justify-between rounded-xl px-3 py-3 font-semibold ${m.urgent ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}
                        >
                          <span className="flex items-center gap-2">
                            <Phone className="h-4 w-4" /> Defesa Civil
                          </span>
                          <span className="font-display text-lg">199</span>
                        </a>
                        <a
                          href="tel:+551532814041"
                          className="flex items-center justify-between rounded-xl border border-primary/40 bg-secondary px-3 py-2.5 font-semibold"
                        >
                          <span>Telefone municipal</span>
                          <span>(15) 3281-4041</span>
                        </a>
                        <a
                          href="https://wa.me/5515981090984"
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-xl border border-primary/40 bg-secondary px-3 py-2.5 font-semibold"
                        >
                          <span>WhatsApp</span>
                          <span>(15) 98109-0984</span>
                        </a>
                      </div>
                    ) : (c.name.includes("Fiscalização") || c.phone === "156") ? (
                      <div key={c.name} className="space-y-2">
                        <a
                          href="tel:+551532812238"
                          className="flex items-center justify-between rounded-xl border border-primary/40 bg-secondary px-3 py-2.5 font-semibold"
                        >
                          <span>Meio Ambiente</span>
                          <span>(15) 3281-2238</span>
                        </a>
                        <a
                          href="tel:+551532811625"
                          className="flex items-center justify-between rounded-xl border border-primary/40 bg-secondary px-3 py-2.5 font-semibold"
                        >
                          <span>Meio Ambiente</span>
                          <span>(15) 3281-1625</span>
                        </a>
                        <a
                          href="tel:+551532817071"
                          className="flex items-center justify-between rounded-xl border border-primary/40 bg-secondary px-3 py-2.5 font-semibold"
                        >
                          <span>Fiscalização de Posturas</span>
                          <span>(15) 3281-7071</span>
                        </a>
                        <a
                          href="tel:+551532817000"
                          className="flex items-center justify-between rounded-xl border border-primary/40 bg-secondary px-3 py-2.5 font-semibold"
                        >
                          <span>Fiscalização de Posturas</span>
                          <span>(15) 3281-7000</span>
                        </a>
                        <a
                          href="tel:+551532382050"
                          className="flex items-center justify-between rounded-xl border border-primary/40 bg-secondary px-3 py-2.5 font-semibold"
                        >
                          <span>Polícia Militar Ambiental</span>
                          <span>(15) 3238-2050</span>
                        </a>
                      </div>
                    ) : c.name === "Corpo de Bombeiros" || c.phone === "193" ? (
                      <div key={c.name} className="space-y-2">
                        <a
                          href="tel:193"
                          className={`flex items-center justify-between rounded-xl px-3 py-3 font-semibold ${m.urgent ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}
                        >
                          <span className="flex items-center gap-2">
                            <Phone className="h-4 w-4" /> Corpo de Bombeiros
                          </span>
                          <span className="font-display text-lg">193</span>
                        </a>
                        <a
                          href="tel:+551532814041"
                          className="flex items-center justify-between rounded-xl border border-primary/40 bg-secondary px-3 py-2.5 font-semibold"
                        >
                          <span>Defesa Civil municipal</span>
                          <span>(15) 3281-4041</span>
                        </a>
                        <a
                          href="https://wa.me/5515981090984"
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-xl border border-primary/40 bg-secondary px-3 py-2.5 font-semibold"
                        >
                          <span>WhatsApp da Defesa Civil</span>
                          <span>(15) 98109-0984</span>
                        </a>
                      </div>
                    ) : (
                      <a
                        key={c.name}
                        href={`tel:${c.phone}`}
                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 font-semibold ${m.urgent ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}
                      >
                        <span className="flex items-center gap-2">
                          <Phone className="h-4 w-4" /> {c.name}
                        </span>
                        <span className="font-display text-lg">{c.phone}</span>
                      </a>
                    ),
                  )}
                </div>
              )}
            </div>
          ),
        )}
        <div ref={endRef} />
      </main>

      <footer className="border-t bg-card/60 p-3 backdrop-blur">
        {form ? (
          <form onSubmit={submit} className="space-y-2">
            {isListening && (
              <p className="px-2 text-xs font-medium text-destructive" role="status">
                Ouvindo... fale com clareza. Toque no microfone para encerrar.
              </p>
            )}
            {speechError && (
              <p className="px-2 text-xs text-muted-foreground" role="status">
                {speechError}
              </p>
            )}
            <div className="flex gap-2">
              {["Violência doméstica", "Descumprimento de medida protetiva de urgência"].includes(form.category) && fieldsForCategory(form.category)[form.step]?.key === "medida_protetiva" && <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-primary/30 px-3 py-2 text-xs font-semibold"><Paperclip className="h-4 w-4" />{medidaFile ? medidaFile.name : "Anexar foto ou PDF da medida (opcional)"}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => { const file = e.target.files?.[0] ?? null; if (file && file.size > 10 * 1024 * 1024) { setMsgs((m) => [...m, { from: "bot", text: "O arquivo deve ter no máximo 10 MB." }]); e.target.value = ""; return; } if (file && !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) { setMsgs((m) => [...m, { from: "bot", text: "Envie uma foto JPG, PNG, WEBP ou um PDF." }]); e.target.value = ""; return; } setMedidaFile(file); }} /></label>}
              {fieldsForCategory(form.category)[form.step]?.key === "descricao" ? (
                <textarea
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Descreva a ocorrência..."
                  rows={3}
                  className="min-h-12 min-w-0 flex-1 resize-y rounded-2xl border bg-input px-4 py-3 text-sm outline-none [overflow-wrap:anywhere] focus:ring-2 focus:ring-ring"
                  style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                />
              ) : (
                <input
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Digite ou fale sua resposta..."
                  className="min-w-0 flex-1 rounded-full border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              )}
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`flex h-12 min-w-12 shrink-0 items-center justify-center gap-1 rounded-full px-3 text-xs font-semibold ${isListening ? "bg-destructive text-destructive-foreground" : "border border-primary/40 bg-secondary text-foreground"}`}
                aria-label={isListening ? "Parar ditado por voz" : "Ditado por voz"}
                title={isListening ? "Parar ditado por voz" : "Ditar resposta pelo microfone"}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                <span>Voz</span>
              </button>
              <button
                disabled={uploadingMedida}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
                aria-label="Enviar"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </form>
        ) : current?.kind === "ask" ? (
          <div className="flex flex-wrap gap-2">
            {current.options.map((o) => (
              <button
                key={o.label}
                onClick={() => {
                  setMsgs((m) => [...m, { from: "user", text: o.label }]);
                  say(o.next);
                }}
                className="rounded-full border border-primary/50 px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground"
              >
                {o.label}
              </button>
            ))}
          </div>
        ) : current?.kind === "gcm" ? (
          <div className="space-y-2">
            <p className="px-2 text-center text-xs text-muted-foreground">
              É necessário declarar ciência para prosseguir com a solicitação.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setMsgs((m) => [
                    ...m,
                    { from: "user", text: "Li e estou ciente. Prosseguir." },
                    { from: "bot", text: FIELDS[0]!.q },
                  ]);
                  setForm({ category: current.category, step: 0, data: {} });
                }}
                className="rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
              >
                Li e estou ciente
              </button>
              <button
                onClick={() => {
                  setForm(null);
                  setNode("__closed");
                  setMsgs((m) => [
                    ...m,
                    { from: "user", text: "Recuso-me a tomar ciência." },
                    {
                      from: "bot",
                      text:
                        "Você optou por não tomar ciência do termo. Por esse motivo, a solicitação foi encerrada e nenhum dado pessoal será coletado neste atendimento.",
                    },
                  ]);
                }}
                className="rounded-full border border-destructive/60 px-4 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10"
              >
                Recuso-me a tomar ciência
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={reset}
            className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground"
          >
            Nova solicitação
          </button>
        )}
      </footer>
    </div>
  );
}
