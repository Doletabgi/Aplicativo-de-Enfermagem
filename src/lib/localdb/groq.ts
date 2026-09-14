"use client";

const GROQ_URL = "https://groq-proxy-dusky.vercel.app/api/groq";

// Modelos suportados na Groq em ordem de preferência (llama-3.1-8b-instant é rápido, estável e gratuito)
const CANDIDATE_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
];

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callGroqMessages(messages: ChatMessage[], maxTokens: number): Promise<string> {
  let lastError = "";

  for (const model of CANDIDATE_MODELS) {
    let response: Response;
    try {
      response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
          max_tokens: maxTokens,
        }),
      });
    } catch (networkErr: any) {
      throw new Error(
        networkErr?.message && !networkErr.message.includes("Failed to fetch")
          ? networkErr.message
          : "Não foi possível conectar ao servidor de IA. Verifique sua conexão com a internet."
      );
    }

    if (response.ok) {
      const data = await response.json();
      return (data.text || "").trim();
    }

    // Tratar mensagens de erro retornadas pelo proxy (campo "error" no JSON de resposta)
    let errorMessage = "";
    try {
      const errData = await response.json();
      if (typeof errData?.error === "string") {
        errorMessage = errData.error;
      } else if (typeof errData?.error?.message === "string") {
        errorMessage = errData.error.message;
      } else if (typeof errData?.message === "string") {
        errorMessage = errData.message;
      } else if (errData?.error) {
        errorMessage = JSON.stringify(errData.error);
      }
    } catch {
      try {
        const text = await response.text();
        if (text && text.length < 300) {
          errorMessage = text;
        }
      } catch {}
    }

    if (!errorMessage) {
      if (response.status === 429) {
        errorMessage = "Limite temporário de requisições de IA atingido. Aguarde alguns instantes e tente novamente.";
      } else if (response.status === 504 || response.status === 502) {
        errorMessage = "O servidor de IA demorou muito para responder. Tente novamente.";
      } else {
        errorMessage = `Falha no serviço de IA (Status ${response.status}).`;
      }
    }

    lastError = errorMessage;

    if (response.status === 404 || errorMessage.toLowerCase().includes("model_not_found")) {
      continue;
    }

    throw new Error(errorMessage);
  }

  throw new Error(lastError || "Não foi possível comunicar com o serviço de IA.");
}

async function callGroq(prompt: string, maxTokens: number): Promise<string> {
  return callGroqMessages([{ role: "user", content: prompt }], maxTokens);
}


export function getOfflineCareProtocol(diagnosis: string): string[] {
  const d = (diagnosis || "").toLowerCase();
  if (/pneumo|dpoc|asma|dispne|respirat|covid|bronq|enfisem|oxigen/.test(d)) {
    return [
      "Monitorar oximetria de pulso contínua e padrão ventilatório a cada 2 horas.",
      "Manter cabeceira do leito elevada em posição de Fowler (30° a 45°).",
      "Estimular tosse produtiva e fisioterapia respiratória de acordo com tolerância.",
      "Administrar oxigenoterapia prescrita e atentar para ressecamento de mucosas.",
      "Avaliar presença de ruídos adventícios (crepitações/sibilos) à ausculta pulmonar.",
      "Garantir aporte hídrico adequado para favorecer a fluidificação de secreções.",
      "Observar sinais precoces de esforço respiratório, cianose e tiragem intercostal."
    ];
  }
  if (/has|hipertens|iam|infarto|cardi|coracao|arritmi|angina|coronar/.test(d)) {
    return [
      "Monitorar pressão arterial e frequência cardíaca em repouso nos horários pré-estabelecidos.",
      "Atentar para queixas de precordialgia ou desconforto torácico e comunicar imediatamente à equipe médica.",
      "Avaliar presença de estase jugular e edema de membros inferiores diariamente.",
      "Realizar balanço hídrico rigoroso e controle de peso se indicado.",
      "Orientar o paciente a evitar esforços bruscos e manobras de Valsalva.",
      "Administrar anti-hipertensivos e vasodilatadores conforme estrita prescrição médica.",
      "Manter acesso venoso periférico exclusivo e pérvio para emergências cardiovasculares."
    ];
  }
  if (/diabet|dm|glicem|insulin|cetoacid/.test(d)) {
    return [
      "Realizar controle de glicemia capilar conforme mapa de horários prescrito (pré e pós-prandial).",
      "Administrar insulinoterapia prescrita atentando rigorosamente para técnica e rotatividade de sítios.",
      "Orientar e monitorar sinais de hipoglicemia (sudorese fria, tremores, taquicardia, tontura).",
      "Inspecionar pele e extremidades inferiores (pés e calcanhares) diariamente.",
      "Acompanhar aceitação alimentar e comunicar recusa de refeições à equipe de nutrição.",
      "Manter hidratação conforme prescrição e atentar para sinais de desidratação."
    ];
  }
  if (/cirurg|pos-op|po|apendic|laparotom|colecist|fratura|ortoped/.test(d)) {
    return [
      "Inspecionar curativo operatório quanto a integridade, presença e características de secreção/sangramento.",
      "Avaliar intensidade da dor pela Escala Visual Analógica (EVA) antes e após analgesia prescrita.",
      "Estimular deambulação precoce assistida e movimentação ativa no leito para profilaxia de TEV.",
      "Verificar e mensurar débito de drenos e sondas cirúrgicas a cada turno.",
      "Monitorar retorno dos ruídos hidroaéreos e eliminação de flatos e evacuações.",
      "Incentivar exercícios respiratórios profundos para prevenir atelectasias pós-anestésicas."
    ];
  }
  if (/sepse|choque|infecc|itu|urinari|celulit|febre/.test(d)) {
    return [
      "Monitorar rigorosamente curva térmica (temperatura axilar) e comunicar picos febris.",
      "Administrar terapia antimicrobiana rigorosamente nos horários para manutenção de níveis séricos eficazes.",
      "Coletar amostras de culturas (sangue/urina/secreções) antes de início de novos antimicrobianos se solicitado.",
      "Avaliar tempo de enchimento capilar (TEC), perfusão periférica e pressão arterial média.",
      "Controlar diurese horária através de sonda vesical de demora e balanço hídrico.",
      "Atentar para sinais de deterioração clínica e alteração de escore MEWS."
    ];
  }
  if (/avc|ave|neurolog|isquem|hemorrag|convuls|epilep|cranio|tce/.test(d)) {
    return [
      "Avaliar nível de consciência pela Escala de Coma de Glasgow e reatividade pupilar a cada 4 horas.",
      "Monitorar pressão arterial com metas estritas conforme protocolo neurointensivo.",
      "Manter cabeceira elevada a 30° com alinhamento da linha média cervical.",
      "Aplicar medidas de prevenção de broncoaspiração (suspender dieta oral se disfagia/rebaixamento).",
      "Instituir protocolo de prevenção de quedas com grades do leito sempre elevadas.",
      "Realizar mobilização no leito e mudanças de decúbito com apoio de coxins."
    ];
  }
  // Padrão Geral Hospitalar / NANDA-I
  return [
    "Monitorar sinais vitais completos (PA, FC, FR, SpO₂, Temperatura e Dor) a cada 4 horas.",
    "Manter acesso venoso periférico salinizado, com fixação limpa, seca e datada.",
    "Realizar mudança de decúbito a cada 2 horas para prevenção de lesões por pressão (LPP).",
    "Avaliar integridade cutânea em proeminências ósseas e aplicar hidratante/ácidos graxos.",
    "Manter grades laterais do leito elevadas e travas de rodas acionadas para prevenção de quedas.",
    "Avaliar nível de consciência, padrão de eliminações fisiológicas e balanço hídrico.",
    "Acompanhar aceitação da dieta e incentivar ingesta hídrica oral se não houver restrição.",
    "Registrar anotações cronológicas de enfermagem e comunicar quaisquer alterações clínicas."
  ];
}

export async function getCareSuggestions(input: {
  diagnosis: string;
  patientName?: string;
  gender?: string;
  age?: string | number;
}): Promise<string[]> {
  if (!input.diagnosis) throw new Error("Diagnóstico é obrigatório");

  const prompt = `Você é um enfermeiro experiente. Com base no diagnóstico abaixo, liste os principais cuidados de enfermagem necessários.

Paciente: ${input.patientName || "Paciente"}
Idade: ${input.age || "N/I"}
Sexo: ${input.gender || "N/I"}
Diagnóstico: ${input.diagnosis}

Liste APENAS os cuidados de enfermagem em formato de tópicos simples (máximo 8 itens), sem explicações extensas. Cada tópico deve começar com um verbo no infinitivo.`;

  try {
    const text = await callGroq(prompt, 900);
    const lines = text
      .split("\n")
      .map((l: string) => l.replace(/^[-•*]\s*/, "").replace(/^\d+[.)]\s*/, "").trim())
      .filter((l: string) => l.length > 10);
    if (lines.length > 0) return lines;
  } catch (err) {
    console.warn("Serviço de IA offline ou indisponível, utilizando protocolo clínico padrão de enfermagem:", err);
  }

  // Fallback offline com protocolo de alta precisão clínica
  return getOfflineCareProtocol(input.diagnosis);
}

export async function getNursingReport(input: {
  diagnosis: string;
  patientName?: string;
  gender?: string;
  age?: string | number;
  vitalSigns?: { label: string; value: string }[];
  medications?: { name: string; dose: string; schedule: string }[];
}): Promise<string> {
  if (!input.diagnosis) throw new Error("Diagnóstico é obrigatório");

  const vitalSigns = input.vitalSigns || [];
  const medications = input.medications || [];

  const vitalSection =
    vitalSigns.length > 0 ? vitalSigns.map((v) => `- ${v.label}: ${v.value}`).join("\n") : "- Sem registros";

  const medSection =
    medications.length > 0
      ? medications.map((m) => `- ${m.name} ${m.dose} (${m.schedule})`).join("\n")
      : "- Sem medicações prescritas";

  const prompt = `Você é um assistente de documentação de enfermagem. Sua única função é ORGANIZAR e REDIGIR em linguagem técnica os dados fornecidos abaixo — você NÃO tem autorização para criar, supor, deduzir ou complementar nenhuma informação clínica que não esteja explicitamente presente nos dados de entrada.

REGRA ABSOLUTA: é preferível deixar uma seção incompleta a inventar qualquer dado (nome, idade, sintoma, medicação, horário, conduta, valor). Nunca presuma um dado "porque faz sentido clinicamente" — isso é proibido.

Use APENAS terminologia técnica de enfermagem amplamente consolidada e reconhecida (ex: posição de Fowler, decúbito dorsal, decúbito lateral). NUNCA invente ou combine termos técnicos que não sejam de uso corrente e validado — na dúvida, descreva de forma simples e genérica em vez de usar um termo técnico impreciso.

Na seção "EVOLUÇÃO CLÍNICA", NÃO repita os valores numéricos exatos dos sinais vitais (que já aparecem em detalhe na seção SINAIS VITAIS logo abaixo) — a Evolução Clínica deve descrever o quadro de forma qualitativa e textual (ex: "mantém-se febril, com discreta taquipneia e saturação limítrofe"), sem repetir os números crus.

DADOS DO PACIENTE (use exatamente como fornecido, sem alterar nome/idade/sexo):
- Nome: ${input.patientName || "Não informado"}
- Idade: ${input.age || "Não informado"}
- Sexo: ${input.gender || "Não informado"}
- Diagnóstico: ${input.diagnosis}

SINAIS VITAIS RECENTES:
${vitalSection}

MEDICAÇÕES EM USO:
${medSection}

Estruture o relatório EXATAMENTE nestas seções, cada uma com título em linha separada:

IDENTIFICAÇÃO DO PACIENTE
[nome, idade, sexo e diagnóstico, apenas como informado acima]

EVOLUÇÃO CLÍNICA
[apenas o que puder ser descrito a partir do diagnóstico e dos dados fornecidos; não crie sintomas, secreções, aspecto ou detalhes que não constem nos dados. Não repita os números dos sinais vitais aqui, descreva o quadro apenas de forma qualitativa e textual]

SINAIS VITAIS
[liste apenas os valores fornecidos em SINAIS VITAIS RECENTES; se a seção veio como "Sem registros", escreva "Não informado"]

MEDICAÇÕES EM USO
[liste apenas as medicações fornecidas em MEDICAÇÕES EM USO, com nome, dose e horário exatamente como informados; se vier "Sem medicações prescritas", escreva "Não informado"]

CUIDADOS DE ENFERMAGEM REALIZADOS
[apenas condutas que possam ser inferidas diretamente do diagnóstico informado, descritas de forma genérica (ex.: monitorização, posicionamento terapêutico); NUNCA invente horários, frequências específicas ("a cada 2h", "a cada 4h"), doses de oxigênio, metas de hidratação em ml ou procedimentos não mencionados nos dados]

ORIENTAÇÕES E OBSERVAÇÕES
[recomendações gerais coerentes com o diagnóstico informado; não invente comunicação com equipe médica ou eventos que não constam nos dados]

Escreva em linguagem técnica de enfermagem, texto corrido, objetivo e profissional, sem listas numeradas extensas. Máximo de 300 palavras. Novamente: se um dado não foi fornecido, escreva "Não informado" nesse campo — nunca substitua por suposição.`;

  const text = await callGroq(prompt, 1300);
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^RELATÓRIO DE ENFERMAGEM\s*/i, "")
    .trim();
}

export function getOfflineNursingAnswer(question: string): string {
  const q = (question || "").toLowerCase();

  if (q.includes("gotejamento") || q.includes("gotas") || q.includes("microgotas") || q.includes("infus")) {
    return `**Cálculo Simplificado de Gotejamento**:
• **Macrogotas (h)**: V / (T × 3) → Ex: 500/(4×3) = **42 gts/min**
• **Macrogotas (min)**: (V × 20) / T
• **Microgotas (h)**: V / T → Ex: 500/4 = **125 microgts/min**
• **Microgotas (min)**: (V × 60) / T
*Regra*: 1 gota = 3 microgotas. Drogas vasoativas sempre em BIC.

📚 *Ref: COFEN / Farmacologia Aplicada à Enfermagem*`;
  }

  if (q.includes("9 certos") || q.includes("nove certos") || q.includes("certos da medicação") || q.includes("administra")) {
    return `**Os 9 Certos (Administração Segura)**:
1. Paciente certo | 2. Medicamento certo | 3. Via certa
4. Hora certa | 5. Dose certa | 6. Registro certo
7. Orientação certa | 8. Forma certa | 9. Resposta/Ação certa

📚 *Ref: COFEN / Protocolo de Segurança do Paciente (MS/OMS)*`;
  }

  if (q.includes("lpp") || q.includes("pressão") || q.includes("curativo") || q.includes("escara") || q.includes("úlcera")) {
    return `**Conduta Rápida em LPP**:
• **Grau 1 (eritema intacto)**: Alívio de pressão + AGE ou filme transparente.
• **Grau 2 (bolha/úlcera rasa)**: SF 0,9% em jato + hidrocoloide ou hidrogel.
• **Grau 3 (tecido adiposo)**: Alginato de cálcio ou espuma de poliuretano.
• **Grau 4 (músculo/osso)**: Desbridamento + alginato/colagenase + cobertura secundária.
*Decúbito*: Mudar posição a cada 2 horas.

📚 *Ref: Diretrizes NPUAP / Prevenção de Lesão por Pressão (MS/Anvisa)*`;
  }

  if (q.includes("sepse") || q.includes("mews") || q.includes("choque") || q.includes("qsofa")) {
    return `**Alerta de Sepse (Protocolo Rápido)**:
• **Critérios qSOFA (≥ 2)**: FR ≥ 22 | Glasgow < 15 | PAS ≤ 100 mmHg.
• **Pacote da 1ª Hora**:
  1. Dosar lactato sérico.
  2. Coletar 2 hemoculturas (antes do antibiótico).
  3. Antibiótico amplo espectro em até 1h.
  4. Volume: 30 mL/kg cristaloide se hipotensão/lactato ≥ 4.
  5. Noradrenalina se PAM < 65 mmHg pós-volume.

📚 *Ref: Instituto Latino-Americano de Sepse (ILAS) / Surviving Sepsis*`;
  }

  if (q.includes("parada") || q.includes("pcr") || q.includes("rcp") || q.includes("acls") || q.includes("bls")) {
    return `**Conduta Rápida em PCR (AHA)**:
• **Compressões**: 100 a 120/min | Profundidade 5-6 cm | 30:2 (sem via aérea).
• **Chocáveis (FV/TVSP)**: Choque imediato + Adrenalina 1 mg a cada 3-5 min + Amiodarona (300 mg / 150 mg).
• **Não Chocáveis (AESP/Assistolia)**: Sem choque. Adrenalina 1 mg imediata + investigar 5H e 5T.

📚 *Ref: Diretrizes de RCP e ACE (American Heart Association - AHA)*`;
  }

  if (q.includes("nanda") || q.includes("diagnóstico")) {
    return `**Estrutura NANDA-I Simplificada**:
• **Fórmula**: [Diagnóstico] + R/A [Causa] + E/P [Sinais/Sintomas]
• **Exemplo**: Troca de gases prejudicada R/A desequilíbrio ventilação-perfusão E/P dispneia e SpO₂ < 90%.
• **NIC (Ação)**: Oxigenoterapia e monitorização respiratória.
• **NOC (Meta)**: SpO₂ estável > 94%.

📚 *Ref: NANDA International / NIC / NOC*`;
  }

  return `Assistente em Modo Simplificado (Econômico). Pergunte sobre:
• Cálculos de gotejamento e doses
• Cuidados em medicações críticas
• Protocolos: Sepse, PCR, LPP e MEWS
• Diagnósticos rápidos NANDA/NIC/NOC

📚 *Ref: COFEN / Diretrizes Clínicas do Ministério da Saúde*`;
}

const NURSING_SYSTEM_PROMPT = `Você é um preceptor e assistente de Enfermagem clínica no Brasil.
MODO DE RESPOSTA ULTRA-SIMPLIFICADO (ECONOMIA MÁXIMA DE TOKENS & AGILIDADE NO PLANTÃO):
1. Seja direto, conciso e objetivo. Vá DIRETO ao ponto clínico, SEM saudações, introduções ou agradecimentos.
2. Formato obrigatório: Use tópicos curtos (bullet points, máximo de 3 a 5 itens breves).
3. Cálculos de enfermagem: Forneça unicamente a fórmula direta, a conta e o resultado final em negrito.
4. Mantenha 100% de precisão técnica e segurança do paciente segundo COFEN/COREN e Ministério da Saúde, mas no menor número de palavras possível.
5. Evite parágrafos longos ou explicações teóricas desnecessárias. Foque na conduta prática e imediata.
6. REFERÊNCIA OBRIGATÓRIA NO FINAL: Adicione SEMPRE no final da resposta exatamente uma linha curta com a referência técnica/científica principal, no formato:
📚 *Ref: [COFEN / Ministério da Saúde / Diretriz específica (ex: NANDA-I, AHA, ILAS, ANVISA)]*`;

export async function askNursingSpecialist(messages: ChatMessage[]): Promise<string> {
  // Limita o histórico recente às últimas 4 mensagens para economizar tokens de entrada
  const recentMessages = messages.length > 4 ? messages.slice(-4) : messages;

  const fullMessages: ChatMessage[] = [
    { role: "system", content: NURSING_SYSTEM_PROMPT },
    ...recentMessages
  ];

  try {
    // 380 tokens para resposta rápida, concisa e econômica com referência
    const response = await callGroqMessages(fullMessages, 380);
    if (response && response.trim().length > 0) {
      return response.trim();
    }
  } catch (err) {
    console.warn("Falha na chamada à IA online, ativando contingência clínica:", err);
  }

  // Fallback offline com protocolos clínicos simplificados com referências
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content || "";
  return getOfflineNursingAnswer(lastUserMsg);
}

