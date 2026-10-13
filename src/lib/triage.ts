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
  | { kind: "gcm"; text: string; category: string; contacts?: Contact[]; urgent?: boolean };

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
      { label: "Violência doméstica / agressão", next: "g_violencia_domestica" },
      { label: "Enchente / desabamento", next: "r_defesa" },
    ],
  },
  menu: {
    kind: "ask",
    text: "Certo. Sobre o que é a sua solicitação?",
    options: [
      { label: "Crimes e ocorrências policiais", next: "crimes" },
      { label: "Segurança / perturbação", next: "seg" },
      { label: "Patrimônio público / escolas / praças", next: "g_patr" },
      { label: "Trânsito", next: "trans" },
      { label: "Meio ambiente / animais", next: "amb" },
      { label: "Fiscalização (som, obras, comércio)", next: "fisc" },
      { label: "Suspeita de tráfico de drogas", next: "r_trafico" },
      { label: "Saúde", next: "r_samu_nu" },
      { label: "Chuva / árvore / risco estrutural", next: "r_defesa" },
    ],
  },
  crimes: {
    kind: "ask",
    text: "Para direcionar corretamente, o fato está acontecendo agora ou já aconteceu?",
    options: [
      { label: "Está acontecendo agora", next: "crimes_agora" },
      { label: "Já aconteceu / quero comunicar", next: "crimes_passado" },
    ],
  },
  crimes_agora: {
    kind: "ask",
    text: "Qual situação melhor descreve o fato? Se houver arma, ameaça, violência ou risco imediato, ligue 190 ou 153 sem esperar o preenchimento do formulário.",
    options: [
      { label: "Furto ou roubo em andamento", next: "g_furto_roubo_agora" },
      { label: "Ameaça ou agressão", next: "g_ameaca_agressao_agora" },
      { label: "Dano / vandalismo", next: "g_dano_vandalismo_agora" },
      { label: "Pessoa ou veículo suspeito", next: "g_suspeito" },
      { label: "Outra ocorrência", next: "g_crime_outra_agora" },
    ],
  },
  crimes_passado: {
    kind: "ask",
    text: "Qual fato você deseja comunicar? A solicitação à GCM será registrada para avaliação; para boletim de ocorrência e investigação, procure também a Polícia Civil pelo 197 ou pela Delegacia Eletrônica de São Paulo.",
    options: [
      { label: "Furto ou roubo já ocorrido", next: "g_furto_roubo_passado" },
      { label: "Ameaça ou agressão", next: "g_ameaca_agressao_passado" },
      { label: "Dano / vandalismo", next: "g_dano_vandalismo_passado" },
      { label: "Outra ocorrência", next: "g_crime_outra_passado" },
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
      { label: "Violência doméstica / Maria da Penha", next: "g_violencia_domestica" },
      { label: "Descumprimento de medida protetiva", next: "g_descumprimento_medida" },
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
    kind: "ask",
    text: "A suspeita de tráfico de drogas ocorre nas proximidades de um próprio público, como praça, escola, parque ou outro espaço municipal?",
    options: [
      { label: "Sim, próximo a próprio público", next: "g_trafico_area_publica" },
      { label: "Não, em outro local", next: "r_trafico_outro_local" },
    ],
  },
  r_trafico_outro_local: {
    kind: "route",
    text: "Para suspeitas de tráfico de drogas em outros locais, comunique a Polícia Militar pelo telefone 190 quando o fato estiver acontecendo ou houver risco imediato. Também é possível realizar denúncia anônima pelo Disque Denúncia 181. Não se aproxime, não confronte os envolvidos e não tente obter provas colocando-se em risco.",
    contacts: [CONTACTS.pm, CONTACTS.denuncia],
  },
  r_civil: {
    kind: "route",
    text: "Para registrar fatos já ocorridos, você pode ligar 197 ou registrar o Boletim de Ocorrência online, por conta própria, pela Delegacia Digital da Polícia Civil do Estado de São Paulo.",
    contacts: [CONTACTS.civil],
  },
  r_fisc: {
    kind: "route",
    text: "Este caso é de responsabilidade da FISCALIZAÇÃO MUNICIPAL / MEIO AMBIENTE da Prefeitura.",
    contacts: [CONTACTS.prefeitura],
  },
  r_transito_sem_vitima: {
    kind: "route",
    text: "Tratando-se de sinistro de trânsito sem vítima, não é necessário aguardar viatura no local. Retirem os veículos da via (se possível e seguro), troquem os dados e façam registros fotográficos. O solicitante pode registrar o Boletim de Ocorrência online pela Delegacia Digital da Polícia Civil de São Paulo; o boletim é importante para o seguro.",
    contacts: [],
  },
  g_furto_roubo_agora: {
    kind: "gcm",
    urgent: true,
    category: "Furto / roubo em andamento",
    text: "Ocorrência informada como em andamento. Se houver risco imediato, arma, ameaça ou violência, ligue 190 ou 153 agora; não espere o formulário nem confronte os envolvidos. A solicitação será enviada para avaliação da GCM.",
    contacts: [CONTACTS.gcm, CONTACTS.pm],
  },
  g_furto_roubo_passado: {
    kind: "gcm",
    category: "Furto / roubo já ocorrido",
    text: "A GCM receberá as informações para avaliação dentro de suas atribuições. Para formalizar o boletim e eventual investigação, procure também a Polícia Civil pelo 197 ou pela Delegacia Eletrônica de São Paulo.",
    contacts: [CONTACTS.gcm, CONTACTS.civil],
  },
  g_ameaca_agressao_agora: {
    kind: "gcm",
    urgent: true,
    category: "Ameaça / agressão em andamento",
    text: "Ocorrência informada como em andamento. Se houver risco à integridade física, arma ou violência, procure local seguro e ligue 190 ou 153 imediatamente. Não espere o formulário.",
    contacts: [CONTACTS.gcm, CONTACTS.pm],
  },
  g_dano_vandalismo_agora: {
    kind: "gcm",
    urgent: true,
    category: "Dano / vandalismo em andamento",
    text: "Ocorrência informada como em andamento. Não confronte o autor. Se houver risco ou ameaça, ligue 190 ou 153. A solicitação será registrada para avaliação da GCM.",
    contacts: [CONTACTS.gcm, CONTACTS.pm],
  },
  g_crime_outra_agora: {
    kind: "gcm",
    urgent: true,
    category: "Outra ocorrência policial em andamento",
    text: "Ocorrência informada como em andamento. Descreva os fatos para avaliação da GCM. Em caso de violência, arma ou risco imediato, ligue 190 ou 153 sem aguardar o formulário.",
    contacts: [CONTACTS.gcm, CONTACTS.pm],
  },
  g_ameaca_agressao_passado: {
    kind: "gcm",
    category: "Ameaça / agressão já ocorrida",
    text: "A GCM receberá as informações para avaliação dentro de suas atribuições. Para formalizar o boletim e eventual investigação, procure também a Polícia Civil.",
    contacts: [CONTACTS.gcm, CONTACTS.civil],
  },
  g_dano_vandalismo_passado: {
    kind: "gcm",
    category: "Dano / vandalismo já ocorrido",
    text: "A solicitação será registrada para avaliação da GCM. Se envolver patrimônio público, informe isso na descrição. Para boletim de ocorrência e investigação, procure também a Polícia Civil.",
    contacts: [CONTACTS.gcm, CONTACTS.civil],
  },
  g_crime_outra_passado: {
    kind: "gcm",
    category: "Outra ocorrência policial já ocorrida",
    text: "Descreva o fato para avaliação da GCM dentro de suas atribuições. Para boletim de ocorrência e investigação, procure também a Polícia Civil.",
    contacts: [CONTACTS.gcm, CONTACTS.civil],
  },
  g_furto_roubo: {
    kind: "gcm",
    urgent: true,
    category: "Furto / roubo",
    text: "A GCM pode receber as informações para avaliação e atuação dentro de suas atribuições. Se o furto ou roubo estiver acontecendo agora, houver suspeito no local, arma, ameaça ou violência, ligue imediatamente 190 (Polícia Militar) ou 153 (GCM). Não confronte os envolvidos. Para formalizar o boletim e eventual investigação, procure também a Polícia Civil pelo 197 ou pela Delegacia Eletrônica.",
    contacts: [CONTACTS.gcm, CONTACTS.pm, CONTACTS.civil],
  },
  g_ameaca_agressao: {
    kind: "gcm",
    urgent: true,
    category: "Ameaça / agressão",
    text: "A GCM pode receber a solicitação e avaliar as providências cabíveis. Se houver agressão em andamento, ameaça imediata, arma ou risco à integridade física, procure um local seguro e ligue 190 (Polícia Militar) ou 153 (GCM). Para registro formal e investigação, procure também a Polícia Civil.",
    contacts: [CONTACTS.gcm, CONTACTS.pm, CONTACTS.civil],
  },
  g_dano_vandalismo: {
    kind: "gcm",
    category: "Dano / vandalismo",
    text: "Informe os detalhes para que a solicitação seja registrada e avaliada pela GCM, especialmente se o fato envolver patrimônio público ou estiver acontecendo nas proximidades. Se o autor estiver no local e houver risco de confronto, não intervenha; ligue 153 ou 190. Para boletim de ocorrência, procure a Polícia Civil.",
    contacts: [CONTACTS.gcm, CONTACTS.pm, CONTACTS.civil],
  },
  g_crime_outra: {
    kind: "gcm",
    category: "Outra ocorrência policial",
    text: "Descreva o fato para que a solicitação seja registrada e avaliada pela GCM dentro de suas atribuições. Em situação urgente, crime violento em andamento ou risco imediato, ligue 190 ou 153. Para boletim de ocorrência e investigação, procure também a Polícia Civil.",
    contacts: [CONTACTS.gcm, CONTACTS.pm, CONTACTS.civil],
  },
  g_trafico_area_publica: {
    kind: "gcm",
    category: "Suspeita de tráfico de drogas em área pública",
    text: "Você pode registrar uma suspeita de tráfico de drogas ocorrendo nas proximidades de próprio público, como praça, escola ou outro espaço municipal. A GCM receberá as informações para avaliação e encaminhamento dentro de suas atribuições, podendo atuar em articulação com a Polícia Militar. Não se aproxime nem confronte os envolvidos. Se o fato estiver acontecendo neste momento ou houver ameaça, arma ou risco imediato, ligue 190 (Polícia Militar) ou 153 (GCM).",
    contacts: [CONTACTS.gcm, CONTACTS.pm, CONTACTS.denuncia],
  },
  g_outra_situacao: {
    kind: "gcm",
    category: "Outra situação",
    text: "Descreva a situação para que a solicitação seja registrada e avaliada pela equipe da GCM. Se houver risco imediato à vida ou crime violento em andamento, ligue 190 ou 153.",
    contacts: [CONTACTS.gcm, CONTACTS.pm],
  },
  g_violencia_domestica: {
    kind: "gcm",
    urgent: true,
    category: "Violência doméstica",
    text: "A GCM pode receber sua solicitação e atuar dentro de suas atribuições, em articulação com a Polícia Militar e os demais serviços competentes. Se a agressão estiver acontecendo agora ou houver risco imediato, procure um local seguro e ligue 190 (Polícia Militar) ou 153 (GCM). Não aguarde o envio de documentos para pedir ajuda.",
    contacts: [CONTACTS.gcm, CONTACTS.pm],
  },
  g_descumprimento_medida: {
    kind: "gcm",
    urgent: true,
    category: "Descumprimento de medida protetiva de urgência",
    text: "Informe o que aconteceu e quais restrições da medida protetiva podem ter sido descumpridas. Se houver risco imediato, procure um local seguro e ligue 190 (Polícia Militar) ou 153 (GCM). A foto ou PDF da decisão pode ser anexada opcionalmente; a falta do documento não impede o atendimento.",
    contacts: [CONTACTS.gcm, CONTACTS.pm],
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
