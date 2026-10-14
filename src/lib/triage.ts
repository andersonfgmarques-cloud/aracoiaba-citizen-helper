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
      { label: "Cachorro solto / animal na via pública", next: "r_animal_solto" },
      { label: "Animal agressivo ou atacando alguém", next: "r_animal_risco" },
      { label: "Maus-tratos contra animais", next: "g_maus_tratos" },
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
    text: "Em caso de furto ou roubo já ocorrido, registre o Boletim de Ocorrência na Polícia Civil, presencialmente em uma unidade policial ou online pela Delegacia Digital de São Paulo. A solicitação enviada à GCM será avaliada dentro de suas atribuições e não substitui o Boletim de Ocorrência.",
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
    kind: "ask",
    text: "Para evitar que uma solicitação seja enviada ao órgão errado, escolha a opção que mais se aproxima do caso. O formulário da GCM será disponibilizado apenas quando a situação puder ser avaliada pela corporação.",
    options: [
      { label: "Crime, ameaça, agressão ou atitude suspeita", next: "crimes" },
      { label: "Cachorro solto ou animal na rua", next: "r_animal_solto" },
      { label: "Animal agressivo ou atacando alguém", next: "r_animal_risco" },
      { label: "Maus-tratos contra animais", next: "g_maus_tratos" },
      { label: "Problema de serviço municipal / fiscalização", next: "r_fisc" },
      { label: "Saúde ou pessoa passando mal", next: "r_samu_nu" },
      { label: "Não sei qual órgão procurar", next: "r_orientacao_geral" },
    ],
  },
  r_animal_solto: {
    kind: "route",
    text: "Cachorro solto na rua, sem ataque ou ameaça em andamento, deve ser encaminhado ao serviço municipal responsável por animais/zoonoses ou à Prefeitura para orientação e recolhimento, conforme o serviço disponível. Esta opção não abre automaticamente uma ocorrência policial da GCM. Informe o endereço ao setor municipal responsável. Se o animal estiver oferecendo perigo imediato, escolha “Animal agressivo ou atacando alguém” ou ligue 153/190 em caso de risco iminente.",
    contacts: [CONTACTS.prefeitura],
  },
  r_animal_risco: {
    kind: "ask",
    text: "Mantenha distância do animal e não tente capturá-lo nem encurralá-lo. Vamos identificar a situação para encaminhar corretamente.",
    options: [
      { label: "Está atacando alguém agora", next: "g_animal_risco_agora" },
      { label: "Não está atacando, mas oferece risco", next: "g_animal_risco_avaliar" },
    ],
  },
  g_animal_risco_agora: {
    kind: "gcm",
    urgent: true,
    category: "Animal agressivo / ataque em andamento",
    text: "Vamos registrar a solicitação para avaliação da GCM. Se houver ataque em andamento ou perigo imediato, ligue também para 190; não espere o envio do formulário. Afaste-se, proteja crianças e outras pessoas se for seguro e não tente capturar o animal. A GCM não realiza captura ou recolhimento de animais.",
    contacts: [CONTACTS.gcm, CONTACTS.pm],
  },
  g_animal_risco_avaliar: {
    kind: "ask",
    text: "Você conhece o tutor ou responsável pelo animal? Se souber quem é, o aplicativo poderá registrar os dados e o endereço para avaliação da GCM. A corporação não realiza captura ou recolhimento do animal.",
    options: [
      { label: "Sim, conheço o responsável", next: "g_animal_risco_tutor" },
      { label: "Não conheço o responsável", next: "r_animal_sem_tutor" },
    ],
  },
  g_animal_risco_tutor: {
    kind: "gcm",
    category: "Animal agressivo / responsável identificado",
    text: "Vamos registrar os dados para avaliação da GCM. Se possível, informe os dados e o endereço completo do tutor ou responsável. A equipe poderá orientar o responsável a manter o animal sob controle e providenciar o recolhimento adequado, conforme as circunstâncias e as medidas cabíveis. A GCM não realiza captura ou recolhimento de animais.",
    contacts: [CONTACTS.gcm],
  },
  r_animal_sem_tutor: {
    kind: "route",
    urgent: true,
    text: "Como o tutor ou responsável não foi identificado, procure a Prefeitura ou o setor municipal responsável por animais/zoonoses para orientação sobre as medidas disponíveis. A GCM não realiza captura ou recolhimento de animais. Mantenha distância e não tente conter o animal. Se houver risco imediato, ataque em andamento ou necessidade de resgate especializado, acione os serviços de emergência pelos contatos abaixo.",
    contacts: [CONTACTS.prefeitura, CONTACTS.gcm, CONTACTS.pm, CONTACTS.bombeiros],
  },
  r_orientacao_geral: {
    kind: "route",
    text: "Não foi possível identificar com segurança qual órgão deve receber a solicitação. Escolha uma categoria específica no menu inicial para receber o encaminhamento correto. A opção “Outra situação” não gera, por si só, registro no CAD da GCM. Para risco imediato à vida ou violência em andamento, ligue 190 ou 153.",
    contacts: [CONTACTS.pm, CONTACTS.gcm],
  },
  g_maus_tratos: {
    kind: "ask",
    text: "Os possíveis maus-tratos estão acontecendo neste momento? Essa resposta ajuda a encaminhar o caso corretamente. Se o animal estiver em perigo imediato, não espere concluir a triagem.",
    options: [
      { label: "Sim, está acontecendo agora", next: "r_maus_tratos_agora" },
      { label: "Não, aconteceu antes / não é emergência", next: "r_depa_maus_tratos" },
    ],
  },
  r_maus_tratos_agora: {
    kind: "gcm",
    urgent: true,
    category: "Maus-tratos contra animais em andamento",
    text: "Vamos registrar sua solicitação pelo aplicativo para avaliação da GCM. Informe o endereço exato e descreva o que está acontecendo, incluindo as condições do animal e, se souber, quando o fato começou. Se o animal estiver em perigo imediato ou o crime estiver acontecendo agora, ligue também para 190; não espere o envio do formulário. Não confronte o possível responsável nem se coloque em risco.",
    contacts: [CONTACTS.gcm, CONTACTS.pm],
  },
  r_depa_maus_tratos: {
    kind: "route",
    text: "Para denunciar maus-tratos que não estejam acontecendo neste momento, utilize o canal oficial da Delegacia Eletrônica de Proteção Animal (DEPA), da Polícia Civil de São Paulo. Será necessário informar o endereço da ocorrência. Preencha somente informações verdadeiras e guarde o número do protocolo e a senha para acompanhar a denúncia. Se o crime começar a acontecer ou houver perigo imediato, ligue 190.",
    contacts: [],
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
