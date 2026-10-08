import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Phone, Shield, RotateCcw, Send, AlertTriangle, CheckCircle2 } from "lucide-react";
import { TREE, CONTACTS, type Contact } from "@/lib/triage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GCM Araçoiaba da Serra – Atendimento ao Cidadão" },
      { name: "description", content: "Assistente de triagem da Guarda Civil Municipal de Araçoiaba da Serra – SP." },
      { property: "og:title", content: "GCM Araçoiaba da Serra – Atendimento" },
      { property: "og:description", content: "Solicite a GCM e saiba qual órgão acionar em cada situação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Msg =
  | { from: "bot"; text: string; contacts?: Contact[]; urgent?: boolean }
  | { from: "user"; text: string }
  | { from: "done"; protocol: string; category: string };

const FIELDS = [
  { key: "nome", q: "Qual o seu nome?" },
  { key: "cpf", q: "Qual o seu CPF? (somente números)" },
  { key: "telefone", q: "Telefone para contato?" },
  { key: "endereco_solicitante", q: "Qual o seu endereço (residência do solicitante)?" },
  { key: "endereco", q: "Endereço ou ponto de referência da ocorrência?" },
  { key: "descricao", q: "Descreva rapidamente o que está acontecendo." },
] as const;

function Index() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [node, setNode] = useState("start");
  const [form, setForm] = useState<{ category: string; step: number; data: Record<string, string> } | null>(null);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const say = (key: string) => {
    const n = TREE[key]!;
    setNode(key);
    if (n.kind === "route") setMsgs((m) => [...m, { from: "bot", text: n.text, contacts: n.contacts, urgent: !!n.urgent }]);
    else if (n.kind === "ask") setMsgs((m) => [...m, { from: "bot", text: n.text }]);
    else {
      setForm({ category: n.category, step: 0, data: {} });
      setMsgs((m) => [...m, { from: "bot", text: n.text }, { from: "bot", text: FIELDS[0]!.q }]);
    }
  };

  useEffect(() => { say("start"); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const reset = () => { setMsgs([]); setForm(null); say("start"); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !input.trim()) return;
    const f = FIELDS[form.step]!;
    const data = { ...form.data, [f.key]: input.trim() };
    setInput("");
    const next = form.step + 1;
    if (next < FIELDS.length) {
      setForm({ ...form, step: next, data });
      setMsgs((m) => [...m, { from: "user", text: input.trim() }, { from: "bot", text: FIELDS[next]!.q }]);
    } else {
      const protocol = `GCM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const prioridade = ["Atitude suspeita", "Perturbação do sossego"].includes(form.category) ? "alta" : "media";
      supabase.from("ocorrencias").insert({ protocolo: protocol, categoria: form.category, prioridade, nome: data['nome']!, telefone: data['telefone']!, endereco: data['endereco']!, descricao: data['descricao']! }).then(({ error }) => {
        if (error) setMsgs((m) => [...m, { from: "bot", text: "Falha ao enviar. Ligue 153.", urgent: true }]);
      });
      setForm(null);
      setNode("__done");
      setMsgs((m) => [...m, { from: "user", text: input.trim() }, { from: "done", protocol, category: form.category }]);
    }
  };

  const current = TREE[node];

  return (
    <div className="mx-auto flex h-screen max-w-lg flex-col">
      <header className="bg-header flex items-center gap-3 border-b px-4 py-4 shadow-lg">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Shield className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold leading-tight">GCM Araçoiaba da Serra</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success" /> Assistente de atendimento online
          </p>
        </div>
        <Link to="/operador" className="rounded-full px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-secondary">CAD</Link>
        <button onClick={reset} aria-label="Reiniciar" className="rounded-full p-2 text-muted-foreground hover:bg-secondary">
          <RotateCcw className="h-5 w-5" />
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto border-b px-4 py-2">
        {[CONTACTS.gcm, CONTACTS.pm, CONTACTS.samu, CONTACTS.bombeiros, CONTACTS.defesa, CONTACTS.denuncia].map((c) => (
          <a key={c.name} href={`tel:${c.phone}`} className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
            {c.name.split(" ")[0]} <span className="text-primary">{c.phone}</span>
          </a>
        ))}
      </div>

      <main className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {msgs.map((m, i) =>
          m.from === "user" ? (
            <div key={i} className="bubble-in ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-sm text-accent-foreground">{m.text}</div>
          ) : m.from === "done" ? (
            <div key={i} className="bubble-in rounded-2xl border border-success/40 bg-card p-4">
              <div className="flex items-center gap-2 font-bold text-success"><CheckCircle2 className="h-5 w-5" /> Solicitação registrada</div>
              <p className="mt-2 text-sm text-muted-foreground">Categoria: {m.category}</p>
              <p className="mt-1 font-display text-xl font-bold text-primary">{m.protocol}</p>
              <p className="mt-2 text-xs text-muted-foreground">Guarde o protocolo. Uma viatura será direcionada conforme a prioridade. Se a situação piorar, ligue 153.</p>
            </div>
          ) : (
            <div key={i} className={`bubble-in max-w-[88%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm ${m.urgent ? "border border-destructive/60 bg-destructive/15" : "bg-card"}`}>
              {m.urgent && <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase text-destructive"><AlertTriangle className="h-4 w-4" /> Urgente</div>}
              <p className="leading-relaxed">{m.text}</p>
              {m.contacts && (
                <div className="mt-3 space-y-2">
                  {m.contacts.map((c) => (
                    <a key={c.name} href={`tel:${c.phone}`} className={`flex items-center justify-between rounded-xl px-3 py-2.5 font-semibold ${m.urgent ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
                      <span className="flex items-center gap-2"><Phone className="h-4 w-4" /> {c.name}</span>
                      <span className="font-display text-lg">{c.phone}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        <div ref={endRef} />
      </main>

      <footer className="border-t bg-card/60 p-3 backdrop-blur">
        {form ? (
          <form onSubmit={submit} className="flex gap-2">
            <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Digite sua resposta..." className="flex-1 rounded-full border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <button className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-label="Enviar"><Send className="h-5 w-5" /></button>
          </form>
        ) : current?.kind === "ask" ? (
          <div className="flex flex-wrap gap-2">
            {current.options.map((o) => (
              <button key={o.label} onClick={() => { setMsgs((m) => [...m, { from: "user", text: o.label }]); say(o.next); }} className="rounded-full border border-primary/50 px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground">
                {o.label}
              </button>
            ))}
          </div>
        ) : (
          <button onClick={reset} className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground">Nova solicitação</button>
        )}
      </footer>
    </div>
  );
}
