# Prontuário Eletrônico de Enfermagem Mobile 🩺📱

Sistema completo de prontuário eletrônico **100% local e offline-first**, projetado especificamente para a prática de enfermagem, acompanhamento à beira-leito e passagens de plantão ágeis. 

Funciona de forma totalmente autônoma no celular via **Capacitor + SQLite Local**, garantindo privacidade absoluta dos dados de saúde (LGPD) e funcionamento ininterrupto mesmo sem acesso à internet.

---

## 🚀 Principais Funcionalidades

### 📋 Gestão de Pacientes & Leitos
- **Identificação do Paciente**: Nome, leito, idade/nascimento, diagnóstico, alertas de risco e foto de identificação.
- **Marcação Prioritária (⭐)**: Destaque visual rápido para pacientes que exigem vigilância intensiva.
- **Múltiplos Setores / Workspaces**: Organização de pacientes por enfermarias, UTI, pronto-socorro ou clínica médica.
- **Bloqueio por PIN de Segurança**: Proteção rápida da tela contra acessos não autorizados durante a rotina hospitalar.

### 📊 Monitorização de Sinais Vitais & Escalas Clínicas
- **Cálculo Automático de Status Clínico**: Estável (verde), Atenção (amarelo) ou Crítico (vermelho) de acordo com os limites fisiológicos.
- **Gráficos de Tendência (Recharts)**: Histórico visual de PA, FC, FR, SpO₂, Temperatura e Glicemia.
- **Escalas Integradas**:
  - Escala de Coma de Glasgow
  - Escala de Dor (EVA)
  - Escala de Braden (Risco de Lesão por Pressão)
  - Escala Lowthian

### 💊 Aprazamento e Checagem Segura de Medicações
- **Horários e Frequências**: Controle de doses únicas, horários fixos e intervalos recorrentes (ex: 4/4h, 6/6h, 8/8h, 12/12h).
- **Detecção de Conflitos e Alergias em Tempo Real**: Alerta automático se uma medicação prescrita coincidir com alergias conhecidas do paciente (ex: Dipirona, Penicilinas, AINEs).
- **Notificações Locais (Push/Alarme)**: Avisos sonoros e lembretes programados no horário exato da administração, disparados localmente pelo Android sem depender de internet.

### 🤖 Assistente Clínico & Preceptor de IA (Online + Offline)
- **Modo Online**: Assistente de IA de alto desempenho via Groq Proxy (modelos LLaMA / DeepSeek / Gemini) para cálculo de gotejamento, interações medicamentosas e diagnósticos NANDA-I / NIC / NOC.
- **Contingência 100% Offline**: Protocolos clínicos instantâneos integrados ao código-fonte para situações de emergência sem sinal de rede:
  - Protocolo de Sepse (qSOFA e Pacote da 1ª Hora - ILAS)
  - Suporte Avançado de Vida em PCR (Diretrizes AHA)
  - Conduta em Lesão por Pressão (NPUAP / ANVISA)
  - Fórmulas diretas de gotejamento (macrogotas e microgotas)
  - Os 9 Certos da Administração de Medicamentos

### 🎙️ Ditado Clínico Inteligente (Voice to Record)
- Reconhecimento de voz integrado para evolução e preenchimento de sinais vitais via comando de áudio à beira-leito, com normalização automática de valores numéricos e termos médicos.

### 📄 Passagem de Plantão & Exportação
- **Relatório de Plantão Automatizado**: Sumário consolidado de intercorrências, medicações pendentes e sinais vitais das últimas 12h/24h.
- **Impressão Otimizada**: Layout limpo para impressão em papel ou exportação em PDF.
- **Compartilhamento Local**: Exportação e importação de prontuários via JSON / QR Code entre aparelhos da equipe.

---

## 🛠️ Stack Tecnológica

- **Frontend & Aplicação**: Next.js 15 (App Router, Static Export), React 19, TypeScript
- **Estilização**: Tailwind CSS 4, Lucide Icons, Temas personalizáveis (Azul, Rosa, Laranja, Dark Mode)
- **Camada Mobile Nativa**: Capacitor 7 (`@capacitor/android`, `@capacitor/local-notifications`, `@capacitor/preferences`)
- **Banco de Dados Local**: SQLite nativo via `@capacitor-community/sqlite` no Android e `sql.js` (WebAssembly) para navegador/desenvolvimento
- **Gráficos & Visualização**: Recharts
- **Testes**: Vitest (103 testes automatizados cobrindo regras clínicas, parsers de voz e cálculo de medicações)
- **IA Serverless Proxy**: `groq-proxy` (Vercel Serverless Function com fallback Groq -> Gemini)

---

## 📁 Estrutura do Repositório

```
├── android/                   # Projeto nativo Android configurado com Capacitor
├── groq-proxy/                # Função serverless opcional para proxy seguro de IA (Vercel)
├── prisma/                    # Modelos e esquemas de dados de referência
├── public/                    # Assets estáticos, ícones e bibliotecas WASM (sql-wasm)
├── src/
│   ├── app/                   # Rotas do Next.js (Dashboard, Pacientes, Medicações, IA, etc.)
│   ├── components/            # Componentes de interface (Chat de IA, Modais, Gráficos, Navbar)
│   ├── lib/
│   │   ├── clinical-allergy-checker.ts # Validador de conflito de alergias
│   │   ├── clinical-voice-parser.ts    # Parser de linguagem natural para voz
│   │   ├── localdb/           # Camada de abstração do SQLite local
│   │   ├── notifications.ts   # Agendamento de alarmes no sistema operacional
│   │   ├── vital-ranges.ts    # Faixas de referência fisiológica
│   │   └── theme.ts           # Gerenciamento de temas visuais
│   └── types/                 # Tipos TypeScript compartilhados
├── .env.example               # Modelo de variáveis de ambiente seguras
├── agents.md                  # Diretrizes de arquitetura para agentes de IA e desenvolvedores
├── capacitor.config.ts        # Configuração do Capacitor para o ecossistema Android
└── prontuario-enfermagem-debug.apk # APK pré-compilado para testes diretos
```

---

## 📲 Como Instalar e Testar o APK no Android

Se você deseja apenas instalar e utilizar o aplicativo no seu dispositivo Android:

1. Baixe o arquivo **`prontuario-enfermagem-debug.apk`** disponível na raiz deste repositório (ou na aba *Releases*).
2. Transfira o arquivo para o seu celular ou baixe diretamente pelo navegador do smartphone.
3. Permita a instalação de fontes desconhecidas nas configurações do Android.
4. Abra o aplicativo e crie seu acesso de enfermeiro local na tela de cadastro inicial.

---

## 💻 Como Executar e Desenvolver Localmente

### Pré-requisitos
- Node.js 18+ instalado
- npm ou pnpm
- Android Studio instalado (caso deseje compilar ou alterar o código nativo Android)

### 1. Clonar o Repositório
```bash
git clone https://github.com/Doletabgi/Aplicativo-de-Enfermagem.git
cd Aplicativo-de-Enfermagem
```

### 2. Instalar Dependências
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente (Opcional)
```bash
cp .env.example .env
```
> O arquivo `.env` é opcional e serve para configurar chaves de IA (Groq/Gemini). No próprio aplicativo, dentro da aba **Configurações**, é possível inserir sua chave diretamente.

### 4. Executar no Navegador (Modo Desenvolvimento)
```bash
npm run dev
```
Acesse: [http://localhost:3000](http://localhost:3000).

### 5. Executar os Testes Automatizados
```bash
npm test
```

---

## 📱 Compilar e Gerar Novo APK Android

O projeto utiliza exportação estática do Next.js sincronizada com o Capacitor Android:

```bash
# 1. Compilar o frontend estático e sincronizar com a pasta android/
npm run cap:sync

# 2. Abrir o projeto no Android Studio
npm run cap:open
```

No Android Studio:
- Vá em **Build > Build Bundle(s) / APK(s) > Build APK(s)** para gerar o arquivo `.apk` de testes.
- O arquivo gerado estará em `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 🔒 Segurança e Privacidade de Dados

- **Dados Sensíveis Não Versionados**: O arquivo `.gitignore` bloqueia explicitamente arquivos `.env`, chaves de assinatura Android (`*.jks`, `*.keystore`, `key.properties`), tokens e credenciais.
- **Armazenamento 100% Local**: Por padrão, nenhum dado clínico, prontuário ou sinal vital de paciente é trafegado para servidores externos. O banco de dados SQLite reside na memória interna e criptografada do aplicativo no aparelho.

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo de licença para mais detalhes.
