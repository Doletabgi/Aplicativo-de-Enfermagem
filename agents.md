# AGENTS.md — Diretrizes para Agentes de IA e Desenvolvedores

Este documento define a arquitetura, convenções clínicas, padrões de código e diretrizes de desenvolvimento para agentes autônomos de IA e desenvolvedores que colaboram no **Prontuário Eletrônico de Enfermagem Mobile**.

---

## 1. Visão Geral e Princípios Fundamentais

1. **Local-First & Offline-First**: O aplicativo deve funcionar 100% sem conexão com a internet. Toda persistência clínica ocorre no banco de dados SQLite local no aparelho do usuário.
2. **Rigência Clínica e Segurança do Paciente**: Todas as regras de cálculo, faixas fisiológicas e condutas devem seguir rigorosamente os protocolos oficiais do **COFEN/COREN**, **Ministério da Saúde**, **ANVISA**, **AHA** e **ILAS**.
3. **Privacidade e LGPD**: Dados identificáveis de pacientes (nome, leito, foto, diagnóstico, sinais vitais) jamais devem ser enviados para servidores remotos, serviços de analytics de terceiros ou IAs na nuvem sem consentimento explícito.
4. **Exportação Estática (Capacitor/Android)**: O projeto é compilado via `next build` com `output: 'export'`. Não existem rotas de servidor Next.js (`src/app/api` não deve ser recriado). Parâmetros de página devem utilizar parâmetros de busca (`/patient?id=123`), e não rotas dinâmicas com colchetes no sistema de arquivos.

---

## 2. Mapa Arquitetural

```
├── android/                         # Camada nativa Android gerada pelo Capacitor
├── groq-proxy/                      # Função serverless opcional para proxy de IA (Vercel)
│   └── api/groq.js                  # Proxy com fallback Groq (LLaMA/DeepSeek) -> Gemini
├── public/                          # Assets estáticos e binários WASM (sql-wasm.wasm)
├── src/
│   ├── app/                         # Rotas Next.js (App Router, estático)
│   │   ├── medications/             # Aprazamento e checagem de medicações
│   │   ├── patient/                 # Detalhes, sinais vitais e prontuário do paciente
│   │   ├── patients/                # Lista e busca de pacientes
│   │   ├── reports/                 # Relatórios e passagem de plantão
│   │   └── settings/                # Ajustes, temas e bloqueio por PIN
│   ├── components/                  # Componentes React
│   │   ├── NursingAIChat.tsx        # Interface do assistente de enfermagem
│   │   ├── VitalSignsChart.tsx      # Gráficos Recharts de evolução fisiológica
│   │   └── PinLock.tsx              # Componente de segurança e bloqueio de tela
│   ├── lib/
│   │   ├── clinical-allergy-checker.ts # Validador de alergias e conflitos medicamentosos
│   │   ├── clinical-voice-parser.ts    # Parser de áudio/voz para registros clínicos
│   │   ├── localdb/                 # Camada de banco de dados SQLite (Nativo / WASM)
│   │   │   ├── client.ts            # Inicialização e queries SQLite
│   │   │   ├── medications.ts       # Operações de medicamentos e doses
│   │   │   ├── patients.ts          # Operações de pacientes
│   │   │   └── groq.ts              # Integração cliente com a IA e contingência offline
│   │   ├── notifications.ts         # Agendamento de alarmes nativos do Android
│   │   ├── vital-ranges.ts          # Limites fisiológicos e alertas
│   │   └── theme.ts                 # Sistema de temas e acessibilidade
```

---

## 3. Assistente de IA e Contingência Clínica

### 3.1. Modo Online
- O cliente (`src/lib/localdb/groq.ts`) chama o endpoint configurado (por padrão, `groq-proxy`).
- **Prompt do Sistema**: Focado em respostas ultra-concisas para profissionais em plantão ativo:
  - Fórmulas diretas e cálculos com resultado final em negrito.
  - Tópicos breves (máximo de 3 a 5 pontos práticos).
  - Citação obrigatória de referência científica no rodapé: `📚 *Ref: [COFEN / MS / AHA / NANDA / ILAS]*`.

### 3.2. Contingência 100% Offline (Obrigatória)
Caso o dispositivo esteja sem internet ou a API falhe, a função `getOfflineNursingAnswer` entra em ação imediatamente fornecendo condutas pré-programadas para:
- **Cálculos de Gotejamento**: Fórmulas de macrogotas e microgotas em horas e minutos.
- **Os 9 Certos**: Protocolo seguro de administração de medicamentos.
- **Sepse / qSOFA**: Critérios diagnósticos e pacote da 1ª hora (ILAS).
- **Parada Cardiorrespiratória (PCR)**: Algoritmo AHA para ritmos chocáveis e não-chocáveis.
- **Lesão por Pressão (LPP)**: Conduta por estadiamento (graus 1 a 4) e prevenção.
- **Diagnósticos NANDA-I / NIC / NOC**: Estrutura diagnóstica rápida.

> ⚠️ **Regra para Agentes**: Nunca remova ou desative o mecanismo de contingência offline. Ele é vital para o uso hospitalar em áreas sem cobertura de rede.

---

## 4. Validações de Segurança do Paciente

### 4.1. Verificador de Alergias (`clinical-allergy-checker.ts`)
- Antes de salvar ou administrar qualquer medicação, o sistema cruza o nome do medicamento com as alergias cadastradas na ficha do paciente.
- Deve tratar variações morfológicas e classes farmacológicas (ex: Dipirona / Metamizol, Penicilina / Amoxicilina, AAS / Anti-inflamatórios não-esteroidais).
- Testes associados: `clinical-allergy-checker.test.ts` e `medications-today.test.ts`.

### 4.2. Parser de Voz Clínica (`clinical-voice-parser.ts`)
- Converte ditados livres (ex: *"PA 12 por 8, saturação 98, dor 3"*) em campos estruturados de sinais vitais.
- Deve validar limites biológicos plausíveis antes de persistir dados no banco.
- Testes associados: `clinical-voice-parser.test.ts` e `voiceParser.test.ts`.

---

## 5. Boas Práticas de Desenvolvimento e Testes

### 5.1. Execução de Testes
Antes de submeter ou finalizar qualquer alteração no código:
```bash
npm test
```
- A suíte de testes (Vitest) contém mais de 100 testes clínicos e de persistência.
- **Nenhum teste pode quebrar**. Novas regras clínicas devem vir acompanhadas de testes unitários.

### 5.2. Verificação de Build
Para garantir conformidade com a exportação estática do Capacitor:
```bash
npm run build
```
Certifique-se de que a compilação estática (`Generating static pages`) é concluída com 100% de sucesso.

### 5.3. Higiene de Segurança e Repositório Público
- **Nunca comite chaves de API, senhas ou arquivos `.env`**.
- Sempre utilize variáveis de ambiente através de `process.env.*` ou inputs nas Configurações do app.
- O arquivo `.gitignore` deve manter bloqueados `.env`, `*.jks`, `*.keystore`, `key.properties` e pastas de cache de build.
- Qualquer novo arquivo que contenha credenciais ou certificados deve ser imediatamente adicionado ao `.gitignore`.
