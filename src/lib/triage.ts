export type Contact = { name: string; phone: string; note: string };

export const CONTACTS = {
  gcm: { name: "GCM Araçoiaba da Serra", phone: "153", note: "Guarda Civil Municipal" },
  pm: { name: "Polícia Militar", phone: "190", note: "Crimes em andamento, violência, roubo" },
  samu: { name: "SAMU", phone: "08000135117", note: "Contato municipal para atendimento de saúde" },
  bombeiros: { name: "Corpo de Bombeiros", phone: "193", note: "Incêndio, resgate, afogamento" },
  defesa: { name: "Defesa Civil", phone: "199", note: "Enchentes, deslizamentos, árvores caídas" },
  denuncia: { name: "Disque Denúncia", phone: "181", note: "Denúncia anônima (tráfico, crimes)" },
  civil: { name: "Polícia Civil", phone: "197", note: "Boletim de ocorrência, investigação" },
  ambiental: { name: "Polícia Militar Ambiental", phone: "190", note: "Crimes ambientais graves" },
  prefeitura: {
    name: "Prefeitura – Fiscalização",
    phone: "156",
    note: "Obras, comércio, som, terrenos",
  },
} satisfies Record<string, Contact>;

export type Option = { label: string; next: string };
export type Node =
  | { kind: "ask"; text: string; options: Option[] }
  | { kind: "route"; text: string; contacts: Contact[]; urgent?: boolean }
  | { kind: "gcm"; text: string; category: string; contacts?: Contact[] };

export const TREE: Record<string, Node> = {
  start: {
    kind: "ask",
    text: "Olá! Sou o assistente da GCM de Araçoiaba da Serra. Antes de tudo: alguém corre risco de vida AGORA?",
    options: [
      { label: "Sim, é emergência", next: "emerg" },
      { label: "Não", next: "menu" },
    ],
  },
  emerg: {
    kind: "ask",
    text: "Qual a situação de emergência?",
    options: [
      { label: "Pessoa ferida / passando mal", next: "r_samu" },
      { label: "Incêndio / pessoa presa", next: "r_bomb" },
      { label: "Crime acontecendo (assalto, arma, agressão)", next: "r_pm" },
      { label: "Enchente / desabamento", next: "r_defesa" },
    ],
  },
  menu: {
    kind: "ask",
    text: "Certo. Sobre o que é a sua solicitação?",
    options: [
      { label: "Segurança / perturbação", next: "seg" },
      { label: "Patrimônio público / escolas / praças", next: "g_patr" },
      { label: "Trânsito", next: "trans" },
      { label: "Meio ambiente / animais", next: "amb" },
      { label: "Fiscalização (som, obras, comércio)", next: "fisc" },
      { label: "Denúncia de tráfico de drogas", next: "r_trafico" },
      { label: "Saúde", next: "r_samu_nu" },
      { label: "Chuva / árvore / risco estrutural", next: "r_defesa" },
    ],
  },
  seg: {
    kind: "ask",
    text: "O fato está acontecendo agora e envolve violência, arma ou roubo?",
    options: [
      { label: "Sim", next: "r_pm" },
      { label: "Já aconteceu (preciso registrar)", next: "r_civil" },
      { label: "Não – perturbação, briga verbal, suspeito", next: "seg2" },
    ],
  },
  seg2: {
    kind: "ask",
    text: "Qual se encaixa melhor?",
    options: [
      { label: "Perturbação do sossego / som alto", next: "g_sossego" },
      { label: "Pessoa ou veículo em atitude suspeita", next: "g_suspeito" },
      { label: "Violência doméstica / Maria da Penha", next: "r_pm" },
      { label: "Apoio em evento / ronda no bairro", next: "g_ronda" },
    ],
  },
  trans: {
    kind: "ask",
    text: "Há feridos no local?",
    options: [
      { label: "Sim", next: "r_samu" },
      { label: "Não – acidente sem vítima", next: "trans_sem_vitima" },
      { label: "Veículo abandonado / estacionamento irregular", next: "g_transito" },
    ],
  },
  trans_sem_vitima: {
    kind: "ask",
    text: "O acidente envolve veículo oficial da Prefeitura (carro, moto ou outro veículo a serviço do município)?",
    options: [
      { label: "Sim, envolve veículo oficial", next: "g_transito_veiculo_oficial" },
      { label: "Não envolve veículo oficial", next: "r_transito_sem_vitima" },
    ],
  },
  amb: {
    kind: "ask",
    text: "Qual o problema ambiental?",
    options: [
      { label: "Queimada / fogo em mato", next: "r_bomb" },
      { label: "Desmatamento / caça / pesca ilegal", next: "g_ambiental" },
      { label: "Descarte irregular de lixo / entulho", next: "r_fisc" },
      { label: "Animal silvestre / peçonhento em casa", next: "r_bomb" },
    ],
  },
  fisc: {
    kind: "ask",
    text: "O problema está ocorrendo agora e há conflito ou ameaça?",
    options: [
      { label: "Sim, há conflito", next: "g_sossego" },
      { label: "Não – é uma reclamação/irregularidade", next: "r_fisc" },
    ],
  },
  r_pm: {
    kind: "route",
    urgent: true,
    text: "Esta é uma ocorrência da POLÍCIA MILITAR. Ligue AGORA para o 190. Se for seguro, permaneça em local protegido e não confronte ninguém.",
    contacts: [CONTACTS.pm],
  },
  r_samu: {
    kind: "route",
    urgent: true,
    text: "Em caso de emergência médica, entre em contato com o SAMU municipal pelos canais abaixo: telefone 0800 013 5117 ou WhatsApp (15) 99767-3839. Se houver suspeita de queda ou acidente, não mova a vítima, salvo se houver perigo imediato no local.",
    contacts: [CONTACTS.samu, CONTACTS.bombeiros],
  },
  r_samu_nu: {
    kind: "route",
    text: "Para entrar em contato com o SAMU municipal, ligue 0800 013 5117 ou envie WhatsApp para (15) 99767-3839. Para atendimentos sem urgência, você também pode procurar a UBS do seu bairro.",
    contacts: [CONTACTS.samu],
  },
  r_bomb: {
    kind: "route",
    urgent: true,
    text: "Acione o CORPO DE BOMBEIROS pelo 193. Afaste-se do local de risco. Para ocorrências ambientais, também estão disponíveis os contatos municipais abaixo.",
    contacts: [CONTACTS.bombeiros, CONTACTS.prefeitura],
  },
  r_defesa: {
    kind: "route",
    urgent: true,
    text: "Situação de DEFESA CIVIL. Ligue 199. Se houver vítimas ou risco imediato, ligue 193.",
    contacts: [CONTACTS.defesa, CONTACTS.bombeiros],
  },
  r_trafico: {
    kind: "route",
    text: "Denúncias de tráfico devem ser feitas de forma ANÔNIMA pelo Disque Denúncia 181. Nunca se exponha nem fotografe suspeitos. Em flagrante com risco, ligue 190.",
    contacts: [CONTACTS.denuncia, CONTACTS.pm],
  },
  r_civil: {
    kind: "route",
    text: "Para registrar fatos já ocorridos, faça o Boletim de Ocorrência na Delegacia Eletrônica (SSP-SP) ou ligue 197.",
    contacts: [CONTACTS.civil],
  },
  r_fisc: {
    kind: "route",
    text: "Este caso é de responsabilidade da FISCALIZAÇÃO MUNICIPAL / MEIO AMBIENTE da Prefeitura.",
    contacts: [CONTACTS.prefeitura],
  },
  r_transito_sem_vitima: {
    kind: "route",
    text: "Tratando-se de sinistro de trânsito sem vítima, não é necessário aguardar viatura no local. Retirem os veículos da via (se possível e seguro), troquem os dados, façam registros fotográficos e registrem o fato na Delegacia Eletrônica da Polícia Civil ou na sede/unidade da Polícia Militar. O boletim é importante para o seguro.",
    contacts: [],
  },
  g_sossego: {
    kind: "gcm",
    category: "Perturbação do sossego",
    text: "Ok, a GCM pode atender. Preciso de alguns dados.",
  },
  g_suspeito: {
    kind: "gcm",
    category: "Atitude suspeita",
    text: "A GCM pode verificar. Preciso de alguns dados.",
  },
  g_ronda: { kind: "gcm", category: "Ronda / apoio", text: "Vamos registrar seu pedido de ronda." },
  g_patr: {
    kind: "gcm",
    category: "Patrimônio público",
    text: "Proteção do patrimônio é atribuição da GCM. Preciso de alguns dados.",
  },
  g_transito: {
    kind: "gcm",
    category: "Trânsito",
    text: "A GCM pode atender. Preciso de alguns dados.",
  },
  g_transito_veiculo_oficial: {
    kind: "gcm",
    category: "Acidente de trânsito envolvendo veículo oficial da Prefeitura",
    text: "Como o acidente envolve veículo oficial da Prefeitura, vamos registrar os dados para encaminhamento e providências cabíveis. Preciso de algumas informações.",
  },
  g_ambiental: {
    kind: "gcm",
    category: "Ambiental",
    text: "A GCM Ambiental pode verificar. Preciso de alguns dados. Se necessário, também contate os serviços ambientais e de fiscalização pelos canais abaixo.",
    contacts: [CONTACTS.prefeitura],
  },
};
