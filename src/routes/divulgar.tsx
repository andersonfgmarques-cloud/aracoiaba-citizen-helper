import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Download, ExternalLink, Printer } from "lucide-react";

const APP_URL = "https://andersonfgmarques-cloud.github.io/aracoiaba-citizen-helper/";
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=720x720&margin=24&color=07182c&bgcolor=ffffff&data=${encodeURIComponent(APP_URL)}`;

export const Route = createFileRoute("/divulgar")({
  head: () => ({
    meta: [
      { title: "Divulgue o Atendimento ao Cidadão | GCM Araçoiaba da Serra" },
      { name: "description", content: "QR Code para acessar o Atendimento ao Cidadão da Guarda Civil Municipal de Araçoiaba da Serra." },
    ],
  }),
  component: DivulgarPage,
});

function DivulgarPage() {
  return (
    <main className="min-h-screen bg-[#07182c] px-4 py-8 text-white sm:px-6">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .qr-poster { box-shadow: none !important; border: 0 !important; margin: 0 auto !important; }
          main { background: white !important; color: #07182c !important; padding: 0 !important; min-height: 0 !important; }
          .poster-muted { color: #334155 !important; }
        }
      `}</style>
      <div className="no-print mx-auto mb-5 flex max-w-4xl flex-wrap items-center justify-between gap-3">
        <a href="/aracoiaba-citizen-helper/" className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"><ArrowLeft className="h-4 w-4" /> Voltar ao aplicativo</a>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-[#f4bd36] px-4 py-2 font-semibold text-[#07182c]"><Printer className="h-4 w-4" /> Imprimir cartaz</button>
          <a href={QR_URL} download="qr-atendimento-cidadao-gcm.png" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 font-semibold hover:bg-white/10"><Download className="h-4 w-4" /> Baixar QR Code</a>
        </div>
      </div>
      <section className="qr-poster mx-auto max-w-3xl rounded-3xl border border-[#f4bd36]/60 bg-[#0b2038] p-6 text-center shadow-2xl sm:p-10">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[#f4bd36]/50 bg-white/5 p-2">
          <img src="/aracoiaba-citizen-helper/BrasaoOfc.png" alt="Brasão oficial da Guarda Civil Municipal de Araçoiaba da Serra" className="h-full w-full object-contain" />
        </div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#f4bd36]">Guarda Civil Municipal</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">Araçoiaba da Serra</h1>
        <div className="mx-auto my-6 h-1 w-24 rounded-full bg-[#f4bd36]" />
        <h2 className="text-2xl font-extrabold sm:text-4xl">Atendimento ao Cidadão</h2>
        <p className="poster-muted mx-auto mt-3 max-w-xl text-base text-slate-300 sm:text-lg">Aponte a câmera do celular para o QR Code e acesse o atendimento online da GCM.</p>
        <div className="mx-auto my-7 inline-block rounded-2xl bg-white p-3 sm:p-5">
          <img src={QR_URL} alt="QR Code para abrir o Atendimento ao Cidadão da GCM Araçoiaba da Serra" className="h-64 w-64 sm:h-80 sm:w-80" />
        </div>
        <p className="text-lg font-bold text-[#f4bd36]">Escaneie. Acesse. Solicite orientação.</p>
        <p className="poster-muted mx-auto mt-3 max-w-xl text-sm text-slate-300">Em situação de risco imediato, procure um local seguro e ligue 190.</p>
        <a href={APP_URL} target="_blank" rel="noreferrer" className="no-print mt-5 inline-flex items-center gap-2 break-all text-sm text-sky-300 underline"><ExternalLink className="h-4 w-4 shrink-0" /> Abrir aplicativo diretamente</a>
      </section>
      <p className="no-print mx-auto mt-5 max-w-3xl text-center text-xs text-slate-400">Antes de imprimir em grande quantidade, teste o QR Code com dois celulares. A imagem do código é gerada por um serviço externo; a página do aplicativo não recebe os dados do aparelho usados para gerar o código.</p>
    </main>
  );
}
