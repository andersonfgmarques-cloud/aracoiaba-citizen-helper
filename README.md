# Araçoiaba Cidadão Direto

> Plataforma digital de atendimento e triagem inteligente para os cidadãos de Araçoiaba da Serra – SP, com foco em orientar cada solicitação para o serviço público responsável.

[![CI](https://github.com/andersonfgmarques-cloud/aracoiaba-citizen-helper/actions/workflows/main.yml/badge.svg)](https://github.com/andersonfgmarques-cloud/aracoiaba-citizen-helper/actions/workflows/main.yml)
[![GitHub](https://img.shields.io/badge/GitHub-Reposit%C3%B3rio-black?logo=github)](https://github.com/andersonfgmarques-cloud/aracoiaba-citizen-helper)
[![Bun](https://img.shields.io/badge/Bun-1.x-black?logo=bun)](https://bun.sh/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-purple?logo=vite)](https://vite.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)

## 📱 Visão geral

O Araçoiaba Cidadão Direto é um projeto de atendimento digital concebido para facilitar o primeiro contato do cidadão com a rede municipal e com os serviços de emergência e proteção pública.

A proposta é funcionar como um assistente de triagem, coletando informações essenciais, identificando a natureza da solicitação e orientando o cidadão para o órgão ou canal oficial adequado.

> ⚠️ Importante: a plataforma não substitui os serviços oficiais de emergência. Em situações de risco imediato, o cidadão deve utilizar os canais oficiais de emergência correspondentes.

## 🎯 Objetivos

- Facilitar o acesso do cidadão aos serviços públicos.
- Reduzir encaminhamentos incorretos.
- Realizar triagem inicial das solicitações.
- Orientar o cidadão sobre qual órgão procurar.
- Organizar informações de forma clara e objetiva.
- Criar uma experiência simples para uso em dispositivos móveis.
- Apoiar a comunicação entre cidadão e serviços públicos.
- Permitir evolução futura para integrações com sistemas municipais.

## 🧭 Fluxo de atendimento

~~~mermaid
flowchart TD
    A[Cidadão inicia atendimento] --> B[Assistente coleta informações]
    B --> C{Qual a natureza da solicitação?}
    C -->|Segurança pública| D[Orientação para canal policial competente]
    C -->|Urgência médica| E[Orientação para SAMU]
    C -->|Incêndio ou resgate| F[Orientação para Bombeiros]
    C -->|Defesa Civil| G[Orientação para Defesa Civil]
    C -->|Fiscalização| H[Encaminhamento para Fiscalização]
    C -->|Meio ambiente| I[Encaminhamento para Meio Ambiente]
    C -->|Denúncia| J[Orientação sobre canal oficial adequado]
    D --> K[Orientação final]
    E --> K
    F --> K
    G --> K
    H --> K
    I --> K
    J --> K
    K --> L[Registro ou continuidade do atendimento]
~~~

### 🔎 Princípio da triagem

1. Segurança e risco imediato
2. Urgência
3. Natureza da ocorrência
4. Órgão responsável
5. Orientação objetiva ao cidadão
6. Registro das informações relevantes

## 🏛️ Áreas de encaminhamento

| Categoria | Exemplos | Destino ou orientação |
|---|---|---|
| Segurança pública | Crime em andamento, ameaça, violência | Canal oficial de emergência ou força policial competente |
| Atendimento médico | Mal súbito, acidente, emergência clínica | SAMU ou serviço médico de emergência |
| Incêndio e salvamento | Incêndio, resgate, emergência com risco | Corpo de Bombeiros |
| Defesa Civil | Alagamento, risco estrutural, deslizamento | Defesa Civil |
| Fiscalização | Irregularidades urbanas ou administrativas | Setor municipal competente |
| Meio ambiente | Fauna, descarte irregular, questões ambientais | Órgão ambiental competente |
| Denúncias | Informações sobre possíveis ilícitos | Canal oficial adequado |

> Os encaminhamentos devem ser definidos de acordo com a legislação, protocolos municipais e competências de cada órgão.

## 🖥️ Arquitetura da aplicação

~~~text
┌─────────────────────────────────────────┐
│           ARAÇOIABA CIDADÃO             │
│              Interface Web              │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│        Fluxo de atendimento / UI        │
│       React + componentes Radix         │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│       Regras e lógica da aplicação      │
│       TypeScript / React / Router       │
└───────────────────┬─────────────────────┘
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
┌──────────────────┐  ┌──────────────────┐
│     Supabase     │  │ Serviços externos│
│ Auth / Database  │  │ conforme evolução│
└──────────────────┘  └──────────────────┘
~~~

## 🧩 Tecnologias

### Front-end
- React 19
- TypeScript
- Vite
- TanStack Router
- TanStack React Query
- Tailwind CSS
- Radix UI
- Lucide React
- React Hook Form
- Zod
- Recharts

### Dados e backend
- Supabase
- Drizzle ORM
- PostgreSQL / Postgres
- @supabase/supabase-js

### Qualidade e testes
- ESLint
- Prettier
- Vitest
- Testing Library
- TypeScript

### Desenvolvimento e CI
- Bun
- Git
- GitHub
- GitHub Actions

## 📁 Estrutura do projeto

~~~text
aracoiaba-citizen-helper/
│
├── .github/
│   └── workflows/
│       └── main.yml          # CI: lint, testes e build
│
├── .lovable/                 # Configurações relacionadas ao Lovable
├── .drizzle/                 # Artefatos/configurações do Drizzle
├── public/                   # Arquivos públicos
├── src/                      # Código principal da aplicação
├── supabase/                 # Configurações e recursos do Supabase
│
├── package.json              # Dependências e scripts
├── bun.lock                  # Lockfile do Bun
├── bunfig.toml               # Configuração do Bun
├── tsconfig.json             # Configuração TypeScript
├── eslint.config.js          # Configuração ESLint
├── drizzle.config.ts         # Configuração Drizzle
└── README.md                 # Documentação do projeto
~~~

> A estrutura pode evoluir conforme novas funcionalidades forem implementadas.

## 🚀 Instalação local

### Pré-requisitos
- Git
- Bun
- Node.js quando necessário por ferramentas específicas do ecossistema

### Clonar o repositório

~~~bash
git clone https://github.com/andersonfgmarques-cloud/aracoiaba-citizen-helper.git
cd aracoiaba-citizen-helper
~~~

### Instalar dependências

~~~bash
bun install
~~~

Para reproduzir exatamente as dependências definidas no lockfile:

~~~bash
bun install --frozen-lockfile
~~~

### Executar em desenvolvimento

~~~bash
bun run dev
~~~

## 🛠️ Scripts disponíveis

| Comando | Finalidade |
|---|---|
| bun run dev | Inicia o ambiente de desenvolvimento |
| bun run build | Gera a build de produção |
| bun run build:dev | Gera build em modo desenvolvimento |
| bun run preview | Executa a pré-visualização da build |
| bun run lint | Executa a análise estática com ESLint |
| bun run format | Formata os arquivos com Prettier |
| bun run test | Executa os testes uma vez |
| bun run test:watch | Executa os testes em modo observação |

## 🔄 Integração contínua

O projeto possui um workflow em .github/workflows/main.yml.

O pipeline é executado em alterações na branch main e em Pull Requests direcionados à main.

~~~mermaid
flowchart LR
    A[Push / Pull Request] --> B[Checkout]
    B --> C[Setup Bun]
    C --> D[bun install --frozen-lockfile]
    D --> E[Lint]
    E --> F[Testes]
    F --> G[Build]
    G --> H[CI aprovado]
~~~

O workflow executa:

~~~bash
bun install --frozen-lockfile
bun run lint
bun run test
bun run build
~~~

## 🔐 Segurança e LGPD

Como o projeto pode lidar futuramente com informações fornecidas por cidadãos, qualquer implementação de armazenamento deve considerar finalidade, minimização, controle de acesso, retenção, segurança e legislação aplicável, incluindo a LGPD.

Princípios recomendados:
- Nunca versionar senhas, tokens ou chaves privadas.
- Utilizar variáveis de ambiente para credenciais.
- Aplicar políticas adequadas no Supabase.
- Validar dados recebidos do usuário.
- Evitar armazenamento desnecessário de dados pessoais.
- Implementar controle de acesso adequado.
- Registrar somente informações necessárias para a finalidade do atendimento.

## 📱 Experiência do cidadão

A interface deve priorizar linguagem simples, botões grandes, poucos passos, acessibilidade, uso em celulares, identificação clara de situações urgentes e confirmação antes de ações importantes.

### Exemplo de jornada

~~~text
CIDADÃO
   │
   ▼
Preciso de ajuda
   │
   ▼
Qual é o problema?
   │
   ├── Segurança
   ├── Saúde
   ├── Incêndio / Resgate
   ├── Defesa Civil
   ├── Fiscalização
   ├── Meio Ambiente
   └── Denúncia
            │
            ▼
       TRIAGEM INICIAL
            │
            ▼
      ORIENTAÇÃO CORRETA
~~~

## 🤖 Evolução para assistente inteligente

O projeto pode evoluir para um assistente capaz de interpretar linguagem natural, identificar palavras-chave de risco, solicitar informações faltantes, classificar a natureza da solicitação, apresentar orientações específicas, identificar situações potencialmente urgentes, encaminhar para canais oficiais e gerar resumos estruturados.

A inteligência artificial deve atuar como camada de apoio à triagem e não substituir protocolos oficiais, agentes públicos ou serviços de emergência.

## 🗺️ Roadmap

### Fase 1 — Fundação
- [x] Repositório GitHub
- [x] Aplicação web
- [x] Stack React/TypeScript/Vite
- [x] CI com GitHub Actions
- [x] Lint
- [x] Testes
- [x] Build

### Fase 2 — Atendimento
- [ ] Fluxo completo de triagem
- [ ] Categorias de atendimento
- [ ] Perguntas condicionais
- [ ] Orientações por categoria
- [ ] Tela de confirmação
- [ ] Acessibilidade aprimorada

### Fase 3 — Integrações
- [ ] Supabase estruturado
- [ ] Autenticação quando necessária
- [ ] Registro seguro de atendimentos
- [ ] Painel administrativo
- [ ] Métricas de atendimento

### Fase 4 — Inteligência
- [ ] Classificação automática
- [ ] Assistente conversacional
- [ ] Detecção de urgência
- [ ] Resumos automáticos
- [ ] Regras de encaminhamento configuráveis

### Fase 5 — Operação
- [ ] Monitoramento
- [ ] Auditoria
- [ ] Controle de acesso
- [ ] Políticas de retenção
- [ ] Documentação operacional
- [ ] Testes de segurança
- [ ] Homologação

## 🧪 Qualidade

Antes de enviar uma alteração para main, recomenda-se executar:

~~~bash
bun run lint
bun run test
bun run build
~~~

## 🤝 Fluxo de desenvolvimento

~~~text
1. Criar ou selecionar uma tarefa
        ↓
2. Desenvolver a alteração
        ↓
3. Executar lint
        ↓
4. Executar testes
        ↓
5. Executar build
        ↓
6. Revisar alterações
        ↓
7. Commit
        ↓
8. Pull Request
        ↓
9. CI
        ↓
10. Revisão e merge
~~~

## 📌 Princípios do projeto

**Clareza** — o cidadão precisa entender rapidamente o que fazer.

**Segurança** — situações críticas devem receber tratamento prioritário e orientação adequada.

**Responsabilidade** — o sistema deve respeitar as competências dos órgãos públicos.

**Privacidade** — coletar somente os dados necessários e protegê-los adequadamente.

**Acessibilidade** — a aplicação deve ser utilizável pelo maior número possível de cidadãos.

**Confiabilidade** — mudanças devem passar por lint, testes e build.

**Evolução** — a arquitetura deve permitir novas integrações sem comprometer a base existente.

## 📄 Licença

A licença do projeto deverá ser definida pelos responsáveis pelo repositório antes de uma distribuição pública formal.

## 🔗 Links

- Repositório: https://github.com/andersonfgmarques-cloud/aracoiaba-citizen-helper
- GitHub Actions: https://github.com/andersonfgmarques-cloud/aracoiaba-citizen-helper/actions
- Lovable: https://lovable.dev/projects/43251e86-4c20-4280-a001-ff92f1d09fda

## 🏛️ Araçoiaba Cidadão Direto

Projeto voltado à construção de uma experiência digital moderna para facilitar o acesso do cidadão de Araçoiaba da Serra aos serviços públicos e aos canais oficiais de atendimento.

**Tecnologia, organização e orientação para aproximar o cidadão do serviço público.**