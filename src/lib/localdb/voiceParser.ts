import * as chrono from "chrono-node";

export interface ParsedSpeechTask {
  patientId: string | null;
  patientName: string;
  description: string;
  scheduledAt: Date | null;
}

function normalizeStr(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function wordToAccentRegex(word: string): string {
  return word
    .split("")
    .map((c) => {
      if (c === "a") return "[aáàâãäAÁÀÂÃÄ]";
      if (c === "e") return "[eéèêëEÉÈÊË]";
      if (c === "i") return "[iíìîïIÍÌÎÏ]";
      if (c === "o") return "[oóòôõöOÓÒÔÕÖ]";
      if (c === "u") return "[uúùûüUÚÙÛÜ]";
      if (c === "c") return "[cçCÇ]";
      return c;
    })
    .join("");
}

interface DateParseResult {
  date: Date;
  matchText: string;
}

/**
 * Tenta extrair data e hora da fala em português usando chrono-node e fallback manual regex.
 */
function extractDateTimePt(text: string): DateParseResult | null {
  // 1. Tentar primeiro com chrono.pt
  try {
    const ptParser = (chrono as any).pt?.casual || (chrono as any).pt;
    if (ptParser && typeof ptParser.parse === "function") {
      const parsed = ptParser.parse(text);
      if (parsed && parsed.length > 0) {
        const item = parsed[0];
        const date = item.date();
        if (date && !isNaN(date.getTime())) {
          return { date, matchText: item.text };
        }
      }
    }
  } catch (err) {
    console.warn("Chrono pt parse error:", err);
  }

  // 2. Fallback manual especializado para português falado em ambiente clínico
  const now = new Date();

  // "daqui a X minutos / horas" ou "em X minutos / horas"
  const relativeMatch = text.match(/(?:daqui\s+a|em)\s+(\d+)\s*(minutos?|min|m|horas?|h)\b/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    const d = new Date(now.getTime());
    if (unit.startsWith("min") || unit === "m") {
      d.setMinutes(d.getMinutes() + amount);
    } else {
      d.setHours(d.getHours() + amount);
    }
    return { date: d, matchText: relativeMatch[0] };
  }

  // "depois de amanhã" (com ou sem horário específico)
  const dayAfterMatch = text.match(/depois\s+de\s+amanh[aã](?:\s*(?:às|as)\s*(\d{1,2})(?:[h:]([0-5]\d)?)?)?/i);
  if (dayAfterMatch) {
    const d = new Date(now.getTime());
    d.setDate(d.getDate() + 2);
    const h = dayAfterMatch[1] ? parseInt(dayAfterMatch[1], 10) : 8;
    const m = dayAfterMatch[2] ? parseInt(dayAfterMatch[2], 10) : 0;
    d.setHours(h, m, 0, 0);
    return { date: d, matchText: dayAfterMatch[0] };
  }

  // "amanhã" (com ou sem horário específico, ex: "amanhã às 14:30", "amanhã às 14h", "amanhã")
  const tomorrowMatch = text.match(/amanh[aã](?:\s*(?:de\s+manh[aã]|à\s+tarde|à\s+noite))?(?:\s*(?:às|as)\s*(\d{1,2})(?:[h:]([0-5]\d)?)?)?/i);
  if (tomorrowMatch) {
    const d = new Date(now.getTime());
    d.setDate(d.getDate() + 1);
    const h = tomorrowMatch[1] ? parseInt(tomorrowMatch[1], 10) : 8;
    const m = tomorrowMatch[2] ? parseInt(tomorrowMatch[2], 10) : 0;
    d.setHours(h, m, 0, 0);
    return { date: d, matchText: tomorrowMatch[0] };
  }

  // "hoje" (com ou sem horário específico, ex: "hoje às 20:00", "hoje às 20h")
  const todayMatch = text.match(/hoje(?:\s*(?:às|as)\s*(\d{1,2})(?:[h:]([0-5]\d)?)?)?/i);
  if (todayMatch) {
    const d = new Date(now.getTime());
    const h = todayMatch[1] ? parseInt(todayMatch[1], 10) : d.getHours() + 1;
    const m = todayMatch[2] ? parseInt(todayMatch[2], 10) : 0;
    d.setHours(h, m, 0, 0);
    return { date: d, matchText: todayMatch[0] };
  }

  // Dias da semana: "segunda", "terça", etc.
  const weekdayMatch = text.match(/(?:na\s+)?(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-feira)?(?:\s*(?:às|as)\s*(\d{1,2})(?:[h:]([0-5]\d)?)?)?/i);
  if (weekdayMatch) {
    const dayName = normalizeStr(weekdayMatch[1]);
    const weekdayMap: Record<string, number> = {
      domingo: 0,
      segunda: 1,
      terca: 2,
      quarta: 3,
      quinta: 4,
      sexta: 5,
      sabado: 6,
    };
    const targetDay = weekdayMap[dayName];
    if (targetDay !== undefined) {
      const d = new Date(now.getTime());
      const currentDay = d.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7; // Próximo dia da semana
      d.setDate(d.getDate() + diff);
      const h = weekdayMatch[2] ? parseInt(weekdayMatch[2], 10) : 8;
      const m = weekdayMatch[3] ? parseInt(weekdayMatch[3], 10) : 0;
      d.setHours(h, m, 0, 0);
      return { date: d, matchText: weekdayMatch[0] };
    }
  }

  // Apenas horário: "às 14:30", "às 14h30", "às 16h", "às 8 horas", "às 08:00"
  const timeOnlyMatch = text.match(/(?:às|as)\s*(\d{1,2})(?:(?:[h:]([0-5]\d)?)|(?:\s*horas?))\b/i);
  if (timeOnlyMatch) {
    const d = new Date(now.getTime());
    const h = parseInt(timeOnlyMatch[1], 10);
    const m = timeOnlyMatch[2] ? parseInt(timeOnlyMatch[2], 10) : 0;
    d.setHours(h, m, 0, 0);
    // Se o horário especificado já tiver passado hoje, agenda para amanhã
    if (d.getTime() <= now.getTime()) {
      d.setDate(d.getDate() + 1);
    }
    return { date: d, matchText: timeOnlyMatch[0] };
  }

  return null;
}

/**
 * Remove menções ao nome do paciente e seus conectores da string falada.
 */
function removePatientFromText(text: string, patientName: string): string {
  if (!patientName) return text;
  const normWords = normalizeStr(patientName)
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (normWords.length === 0) return text;

  // 1. Tentar nome completo com tolerância a acentos
  const fullPatternStr = normWords.map(wordToAccentRegex).join("\\s+");
  const fullRegex = new RegExp(
    "(?:\\b(?:no\\s+paciente|na\\s+paciente|para\\s+o|para\\s+a|para|de|da|do|ao|com|leito)\\s+)?\\b" +
      fullPatternStr +
      "\\b",
    "i"
  );
  if (fullRegex.test(text)) {
    return text.replace(fullRegex, " ");
  }

  // 2. Tentar primeiro nome se tiver pelo menos 3 caracteres
  if (normWords[0].length >= 3) {
    const firstPatternStr = wordToAccentRegex(normWords[0]);
    const firstRegex = new RegExp(
      "(?:\\b(?:no\\s+paciente|na\\s+paciente|para\\s+o|para\\s+a|para|de|da|do|ao|com)\\s+)?\\b" +
        firstPatternStr +
        "\\b",
      "i"
    );
    if (firstRegex.test(text)) {
      return text.replace(firstRegex, " ");
    }
  }

  return text;
}

/**
 * Limpa conectores de início e fim e espaços extras para extrair a descrição da tarefa.
 */
function cleanDescription(text: string): string {
  let cleaned = text.trim();

  // Limpa conectores soltos no início ou fim
  cleaned = cleaned.replace(/^(?:para\s+o|para\s+a|para|de|da|do|as|às|ao|no|na|em|o|a|e)\s+/i, "");
  cleaned = cleaned.replace(/\s+(?:para\s+o|para\s+a|para|de|da|do|as|às|ao|no|na|em|o|a|e)$/i, "");

  // Remove pontuações desnecessárias da fala
  cleaned = cleaned.replace(/[.,:;!?\\-]+/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Parser de voz principal: recebe a fala transcrita e a lista de pacientes ativos
 * e extrai paciente, horário agendado e descrição da tarefa clínica.
 */
export function parseTaskFromSpeech(
  text: string,
  patients: { id: string; name: string }[]
): ParsedSpeechTask {
  let remaining = text ? text.trim() : "";
  let scheduledAt: Date | null = null;
  let patientId: string | null = null;
  let patientName = "";

  if (!remaining) {
    return { patientId: null, patientName: "", description: "", scheduledAt: null };
  }

  // 1. Extrair data e hora
  const dateResult = extractDateTimePt(remaining);
  if (dateResult) {
    scheduledAt = dateResult.date;
    // Remove o trecho de data do texto restante
    remaining = remaining.replace(dateResult.matchText, " ");
  }

  // 2. Identificar paciente por maior correspondência
  const normRemaining = normalizeStr(remaining);
  let bestMatch: { patient: { id: string; name: string }; score: number } | null = null;

  for (const p of patients) {
    const normFullName = normalizeStr(p.name);
    const words = normFullName.split(/\s+/).filter((w) => w.length > 1);
    const firstName = words[0] || "";

    // Correspondência de nome completo tem maior prioridade
    if (normFullName.length > 2 && normRemaining.includes(normFullName)) {
      const score = normFullName.length * 2;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { patient: p, score };
      }
    } else if (firstName.length >= 3 && normRemaining.includes(firstName)) {
      // Correspondência por primeiro nome
      const score = firstName.length;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { patient: p, score };
      }
    }
  }

  if (bestMatch) {
    patientId = bestMatch.patient.id;
    patientName = bestMatch.patient.name;
    remaining = removePatientFromText(remaining, patientName);
  }

  // 3. Limpar texto restante para gerar a descrição
  const description = cleanDescription(remaining);

  return {
    patientId,
    patientName,
    description,
    scheduledAt,
  };
}
