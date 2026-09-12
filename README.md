# Prontuário Eletrônico de Enfermagem

Sistema de prontuário eletrônico pessoal e simplificado para acompanhamento diário de pacientes por um único enfermeiro.

## Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS 4
- Prisma ORM + PostgreSQL
- React Hook Form + Zod
- Recharts (gráficos de sinais vitais)
- Lucide Icons

## Instalação

```bash
npm install
```

## Configuração

Copie `.env.example` para `.env` e ajuste os valores (banco, admin, Ollama):

```bash
cp .env.example .env
```

Suba o banco PostgreSQL (via Docker Compose) e depois aplique o schema:

```bash
docker-compose up -d db
npm run migrate:deploy
```

## Execução

Para subir tudo (app + PostgreSQL) com Docker:

```bash
docker-compose up --build
```

Acesse: http://localhost:3008

Para desenvolvimento local (com o Postgres já rodando):

```bash
npm run dev
```

Acesse: http://localhost:3000

## Estrutura

```
src/
├── app/
│   ├── api/                     # API routes
│   │   ├── patients/            # CRUD pacientes
│   │   ├── vital-signs/         # Sinais vitais
│   │   ├── medications/         # Medicações
│   │   ├── nursing-notes/       # Evoluções
│   │   ├── settings/            # Configurações
│   │   ├── upload/              # Upload de fotos
│   │   └── pin/                 # Verificação de PIN
│   ├── patients/                # Lista e cadastro de pacientes
│   ├── patient/[id]/            # Detalhes e impressão
│   ├── settings/                # Configurações do sistema
│   ├── page.tsx                 # Dashboard
│   └── layout.tsx               # Layout raiz
├── components/                  # Componentes reutilizáveis
├── lib/
│   ├── prisma.ts                # Cliente Prisma
│   ├── vital-ranges.ts          # Faixas de referência
│   └── status.ts                # Cálculo de status clínico
└── types/                       # Tipos TypeScript
```

## Trava por PIN

Nas Configurações (/settings), é possível definir um PIN de 4 a 6 dígitos.

- **Com PIN:** Ao abrir o sistema, uma tela de bloqueio é exibida exigindo o PIN.
  - Após acertar, um cookie "unlocked" é definido por 4 horas.
- **Sem PIN:** O sistema abre diretamente, sem proteção.

Para desativar, basta limpar o campo PIN nas configurações e salvar.

## Status Clínico Calculado

O status de cada paciente é calculado em tempo real com base no último sinal vital registrado de cada tipo:

| Status | Cor | Critério |
|--------|-----|----------|
| Estável | Verde | Todos os sinais dentro da faixa normal |
| Atenção | Amarelo | Pelo menos um sinal fora da faixa normal |
| Crítico | Vermelho | Pelo menos um sinal em faixa crítica |
| Sem dados | Cinza | Nenhum sinal vital registrado |

## Faixas de Referência

- Temperatura: 36.0–37.5 °C
- Pressão arterial: sistólica 90–140 / diastólica 60–90 mmHg
- Frequência cardíaca: 60–100 bpm
- Frequência respiratória: 12–20 irpm
- Saturação O₂: ≥ 95%
- Glicemia: 70–140 mg/dL
- Escala de dor: 0–3 (0-10)

## Funcionalidades

- Dashboard com visão geral de pacientes e alertas
- CRUD completo de pacientes com foto via upload
- Registro de sinais vitais com histórico e gráfico Recharts
- Checklist de medicações com cálculo automático de atraso
- Evoluções de enfermagem com edição/exclusão
- Marcação de paciente prioritário (⭐)
- Busca textual e filtros por status
- Geração de link WhatsApp com números de emergência ou padrão
- View de impressão otimizada para passagem de plantão
- Modo escuro para plantão noturno
- Trava de tela opcional por PIN
- Design mobile-first responsivo

## Licença

MIT
