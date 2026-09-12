import type { VitalSignType } from "@/types";

export interface ParsedPatientVoiceData {
  name?: string;
  birthDate?: string;
  gender?: "Masculino" | "Feminino" | "Outro";
  bed?: string;
  diagnosis?: string;
  allergies?: string;
  condition?: "CRITICO" | "ATENCAO" | "";
  rawTranscript: string;
}

const MONTHS_MAP: Record<string, string> = {
  janeiro: "01",
  fevereiro: "02",
  março: "03",
  marco: "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
};

/**
 * Capitalizes a person's full name properly in Portuguese.
 * Example: "joao carlos da silva" -> "Joao Carlos da Silva"
 */
export function formatPersonName(rawName: string): string {
  const lowerWords = ["da", "de", "do", "das", "dos", "e"];
  return rawName
    .trim()
    .split(/\s+/)
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && lowerWords.includes(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * Normalizes spoken date formats into DD/MM/YYYY.
 * Examples:
 * - "15 de março de 1980" -> "15/03/1980"
 * - "10/05/1992" -> "10/05/1992"
 * - "2 de janeiro de 2001" -> "02/01/2001"
 */
export function parseSpokenDate(text: string): string | null {
  if (!text) return null;
  const clean = text.trim();

  // Pattern: DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = clean.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0");
    const month = slashMatch[2].padStart(2, "0");
    let year = slashMatch[3];
    if (year.length === 2) {
      year = parseInt(year) > 30 ? `19${year}` : `20${year}`;
    }
    return `${day}/${month}/${year}`;
  }

  // Pattern: "15 de março de 1980" or "15 de marco de 1980"
  const textMonthMatch = clean.match(
    /\b(\d{1,2})\s+de\s+([a-zA-ZçÇ]+)\s+(?:de\s+)?(\d{2,4})\b/i
  );
  if (textMonthMatch) {
    const day = textMonthMatch[1].padStart(2, "0");
    const monthWord = textMonthMatch[2].toLowerCase();
    const month = MONTHS_MAP[monthWord];
    let year = textMonthMatch[3];
    if (year.length === 2) {
      year = parseInt(year) > 30 ? `19${year}` : `20${year}`;
    }
    if (month) {
      return `${day}/${month}/${year}`;
    }
  }

  return null;
}

/**
 * Parses free-form spoken Portuguese text into structured patient fields.
 * Works 100% offline with zero external network dependencies.
 */
export function parseClinicalVoiceInput(transcript: string): ParsedPatientVoiceData {
  const result: ParsedPatientVoiceData = {
    rawTranscript: transcript,
  };

  if (!transcript || !transcript.trim()) {
    return result;
  }

  const text = transcript.trim();

  // 1. Gender / Sexo
  if (/\b(?:sexo\s+)?masculino\b|\bhomem\b/i.test(text)) {
    result.gender = "Masculino";
  } else if (/\b(?:sexo\s+)?feminino\b|\bmulher\b/i.test(text)) {
    result.gender = "Feminino";
  } else if (/\b(?:sexo\s+)?outro\b/i.test(text)) {
    result.gender = "Outro";
  }

  // 2. Clinical Condition / Classificação de Risco
  // Prioritize explicit statements: "estado de atenção", "estado crítico", "estado estável"
  if (/\b(?:estado\s+(?:de\s+)?|risco\s+|classifica[çc][ãa]o\s+(?:de\s+)?|condi[çc][ãa]o\s+)aten[çc][ãa]o\b/i.test(text)) {
    result.condition = "ATENCAO";
  } else if (/\b(?:estado\s+(?:de\s+)?|risco\s+|classifica[çc][ãa]o\s+(?:de\s+)?|condi[çc][ãa]o\s+)cr[íi]tico\b/i.test(text)) {
    result.condition = "CRITICO";
  } else if (/\b(?:estado\s+(?:de\s+)?|risco\s+|classifica[çc][ãa]o\s+(?:de\s+)?|condi[çc][ãa]o\s+)est[áa]vel\b|\bbom\s+estado\b/i.test(text)) {
    result.condition = "";
  } else if (/\baten[çc][ãa]o\b|\balerta\b|\bintermedi[áa]rio\b/i.test(text)) {
    result.condition = "ATENCAO";
  } else if (/\bcr[íi]tico\b|\bgrave\b|\brisco\s+alto\b/i.test(text)) {
    result.condition = "CRITICO";
  } else if (/\best[áa]vel\b|\bnormal\b/i.test(text)) {
    result.condition = "";
  }

  // 3. Date of Birth / Data de Nascimento
  // Check for explicit "nascido em ...", "data de nascimento ...", etc.
  const birthDateMatch = text.match(
    /(?:nascid[oa](?:\s+em)?|data\s+de\s+nascimento(?:\s+[ée])?|anivers[áa]rio(?:\s+[ée])?)\s*[:]?\s*([0-9a-zA-ZçÇ\s\/\-]+?)(?=[,.]|\bsexo\b|\bleito\b|\bquarto\b|\bdiagn[óo]stico\b|\balergia\b|\bestado\b|$)/i
  );
  if (birthDateMatch) {
    const parsedDate = parseSpokenDate(birthDateMatch[1]);
    if (parsedDate) {
      result.birthDate = parsedDate;
    }
  } else {
    // Look for any date pattern in the text if not found explicitly
    const generalDate = parseSpokenDate(text);
    if (generalDate) {
      result.birthDate = generalDate;
    }
  }

  const cleanPunct = (s: string) => s.replace(/^[\s,;:\-]+|[\s,;:\-]+$/g, "").trim();

  // 4. Bed / Leito
  const bedMatch = text.match(
    /\b(?:leito|quarto|enfermaria|leito\s+n[úu]mero|leito\s+nº|box|uti)\s*[:]?\s*([0-9a-zA-Z\s\-]+?)(?=[,.]|\bdiagn[óo]stico\b|\balergia\b|\bal[ée]rgic[oa]\b|\bnega\s+alergias?\b|\bsem\s+alergias?\b|\bcom\b|\bestado\b|\bcondi[çc][ãa]o\b|\bsexo\b|\bnascid[oa]\b|$)/i
  );
  if (bedMatch) {
    const bedClean = cleanPunct(
      bedMatch[1].replace(/\b(?:n[úu]mero|nº)\b/gi, "")
    );
    if (bedClean.length > 0 && bedClean.length <= 20) {
      result.bed = bedClean.toUpperCase();
    }
  }

  // 5. Patient Name / Nome Completo
  // Try matching "paciente [Nome]" or "nome do paciente é [Nome]"
  const nameMatch = text.match(
    /(?:paciente(?:\s+[ée]|\s+chamad[oa])?|nome(?:\s+do\s+paciente)?(?:\s+[ée])?)\s*[:]?\s*([A-Za-zÀ-ÖØ-öø-ÿ\s]+?)(?=[,.]|\bnascid[oa]\b|\bdata\s+de\s+nascimento\b|\bcom\s+\d+\s+anos\b|\bsexo\b|\bleito\b|\bquarto\b|\bdiagn[óo]stico\b|\balergia\b|\bal[ée]rgic[oa]\b|\bnega\s+alergias?\b|\bsem\s+alergias?\b|\bestado\b|$)/i
  );
  if (nameMatch) {
    const extractedName = cleanPunct(nameMatch[1]);
    // Validate minimum name length and exclude isolated command words
    if (extractedName.length >= 3 && !/^(masculino|feminino|leito|diagnostico|alergia)$/i.test(extractedName)) {
      result.name = formatPersonName(extractedName);
    }
  }

  // 6. Allergies / Alergias
  if (/\b(?:sem\s+alergias?|nega\s+alergias?|n[ãa]o\s+(?:possui|tem)\s+alergias?|alergias?\s+negadas?)\b/i.test(text)) {
    result.allergies = "Nega alergias conhecidas";
  } else {
    const allergiesMatch = text.match(
      /\b(?:al[ée]rgic[oa]\s+(?:a|ao|aos|à|às)?|alergia\s+(?:a|ao|aos|à|às)?|alergias?\s*[:]?)\s*([A-Za-zÀ-ÖØ-öø-ÿ0-9\s,]+?)(?=[.]|\bdiagn[óo]stico\b|\bleito\b|\bestado\b|\bcondi[çc][ãa]o\b|\bsexo\b|\bnascid[oa]\b|$)/i
    );
    if (allergiesMatch) {
      const rawAllergy = cleanPunct(allergiesMatch[1]);
      if (/^(n[ãa]o\s+tem|nenhuma|nega|sem\s+alergias?|desconhecida)$/i.test(rawAllergy)) {
        result.allergies = "Nega alergias conhecidas";
      } else if (rawAllergy.length > 1) {
        result.allergies = rawAllergy.charAt(0).toUpperCase() + rawAllergy.slice(1);
      }
    }
  }

  // 7. Diagnosis / Diagnóstico
  const diagMatch = text.match(
    /\b(?:diagn[óo]stico(?:\s+principal)?|hip[óo]tese\s+diagn[óo]stica|quadro\s+de|internad[oa]\s+por|motivo\s+da\s+interna[çc][ãa]o)\s*[:]?\s*(?:[ée]|de|com)?\s*([A-Za-zÀ-ÖØ-öø-ÿ0-9\s,\/\-]+?)(?=[.]|\balergia\b|\bal[ée]rgic[oa]\b|\bnega\s+alergias?\b|\bsem\s+alergias?\b|\bleito\b|\bestado\b|\bcondi[çc][ãa]o\b|\bsexo\b|\bnascid[oa]\b|$)/i
  );
  if (diagMatch) {
    const rawDiag = cleanPunct(diagMatch[1]);
    if (rawDiag.length > 2) {
      result.diagnosis = rawDiag.charAt(0).toUpperCase() + rawDiag.slice(1);
    }
  }

  return result;
}

export interface ParsedMedicationVoiceData {
  name?: string;
  dose?: string;
  schedule?: string;
  frequency?: string;
  observation?: string;
  rawTranscript: string;
}

const NUMBER_WORDS_MAP: Record<string, string> = {
  meio: "1/2",
  meia: "1/2",
  um: "1",
  uma: "1",
  dois: "2",
  duas: "2",
  tres: "3",
  três: "3",
  quatro: "4",
  cinco: "5",
  seis: "6",
  sete: "7",
  oito: "8",
  nove: "9",
  dez: "10",
  onze: "11",
  doze: "12",
  treze: "13",
  quatorze: "14",
  catorze: "14",
  quinze: "15",
  dezesseis: "16",
  dezessete: "17",
  dezoito: "18",
  dezenove: "19",
  vinte: "20",
  trinta: "30",
  quarenta: "40",
  cinquenta: "50",
  sessenta: "60",
  setenta: "70",
  oitenta: "80",
  noventa: "90",
  zero: "0",
  cem: "100",
  cento: "100",
  duzentos: "200",
  duzentas: "200",
  trezentos: "300",
  quatrocentos: "400",
  quinhentos: "500",
  quinhentas: "500",
  seiscentos: "600",
  setecentos: "700",
  oitocentos: "800",
  novecentos: "900",
  mil: "1000",
};

/**
 * Normaliza horário falado para formato HH:MM (24h).
 * Exemplos:
 * - "8 horas" -> "08:00"
 * - "14:30" -> "14:30"
 * - "8 da noite" -> "20:00"
 * - "duas da tarde" -> "14:00"
 */
export function parseSpokenTime(text: string): string | null {
  if (!text) return null;
  const clean = text.trim().toLowerCase();

  // Formato direto HH:MM ou H:MM
  const directMatch = clean.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (directMatch) {
    return `${directMatch[1].padStart(2, "0")}:${directMatch[2]}`;
  }

  // Substitui palavras numéricas
  let processed = clean;
  for (const [w, n] of Object.entries(NUMBER_WORDS_MAP)) {
    const reg = new RegExp(`\\b${w}\\b`, "gi");
    processed = processed.replace(reg, n);
  }

  // Caso 1: Com prefixo (ex: "às 8 horas", "horário 14:00", "às duas da tarde")
  const prefixMatch = processed.match(
    /\b(?:[àa]s|ás|hor[áa]rio\s*(?:de)?|in[íi]cio\s*(?:[àa]s)?)\s*([01]?\d|2[0-3])(?:\s*(?:h|hrs?|horas?|:))?(?:\s*(?:e\s*)?([0-5]\d)(?:\s*min(?:utos?)?)?)?(?:\s*(da\s+manh[ãa]|da\s+tarde|da\s+noite))?\b/i
  );

  // Caso 2: Com sufixo explícito (ex: "8 horas", "14h30", "8 da noite")
  const suffixMatch = processed.match(
    /\b([01]?\d|2[0-3])\s*(?:h|hrs?|horas?)(?:\s*(?:e\s*)?([0-5]\d)(?:\s*min(?:utos?)?)?)?(?:\s*(da\s+manh[ãa]|da\s+tarde|da\s+noite))?\b/i
  ) || processed.match(
    /\b([01]?\d|2[0-3])\s*(da\s+manh[ãa]|da\s+tarde|da\s+noite)\b/i
  );

  const match = prefixMatch || suffixMatch;
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2] && /^\d+$/.test(match[2]) ? parseInt(match[2], 10) : 0;
    const period = (match[3] || match[2] || "").toLowerCase();

    if (period.includes("tarde") || period.includes("noite")) {
      if (hour < 12) hour += 12;
    } else if (period.includes("manhã") && hour === 12) {
      hour = 0;
    }

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * Normaliza termos clínicos falados em abreviações padrão de enfermagem.
 * Exemplo: "dipirona quinhentos miligramas uma ampola endovenosa" -> "Dipirona 500mg 1 ampola EV"
 */
export function normalizeSpokenMedication(text: string): string {
  if (!text) return "";
  let res = text.trim();

  // Substituição de números por extenso
  for (const [w, n] of Object.entries(NUMBER_WORDS_MAP)) {
    const reg = new RegExp(`\\b${w}\\b`, "gi");
    res = res.replace(reg, n);
  }

  // Unidades e vias hospitalares
  res = res
    .replace(/\b(?:miligramas?|mgs?)\b/gi, "mg")
    .replace(/\b(?:microgramas?|mcgs?)\b/gi, "mcg")
    .replace(/\b(?:gramas?)\b/gi, "g")
    .replace(/\b(?:mililitros?|mls?)\b/gi, "ml")
    .replace(/\b(?:ampolas?|amps?)\b/gi, "ampola")
    .replace(/\b(?:comprimidos?|cps?)\b/gi, "comp")
    .replace(/\b(?:unidades?(?:\s+internacionais)?|ui)\b/gi, "UI")
    .replace(/\b(?:frascos?)\b/gi, "frasco")
    .replace(/\b(?:gotas?)\b/gi, "gotas")
    .replace(/\b(?:endovenos[ao]|intravenos[ao]|ev|iv)\b/gi, "EV")
    .replace(/\b(?:via\s+oral|oral|vo)\b/gi, "VO")
    .replace(/\b(?:subcut[âa]ne[ao]|sc)\b/gi, "SC")
    .replace(/\b(?:intramuscular|im)\b/gi, "IM")
    .replace(/\b(?:sublingual|sl)\b/gi, "SL")
    .replace(/\s+/g, " ")
    .trim();

  // Remove espaço entre número e unidade de dosagem (exceto UI para legibilidade)
  res = res.replace(/(\d+(?:[.,]\d+)?)\s*(mg|mcg|g|ml)\b/gi, "$1$2");

  if (res.length > 0) {
    res = res.charAt(0).toUpperCase() + res.slice(1);
  }

  return res;
}

/**
 * Extrai campos estruturados de medicação (nome, dose, horário, intervalo, obs) a partir da fala contínua.
 */
export function parseMedicationVoiceInput(transcript: string): ParsedMedicationVoiceData {
  const result: ParsedMedicationVoiceData = {
    rawTranscript: transcript,
  };

  if (!transcript || !transcript.trim()) return result;

  const text = normalizeSpokenMedication(transcript);

  // 1. Horário (Schedule)
  const timeMatch = text.match(
    /\b(?:[àa]s|ás|hor[áa]rio\s*(?:de)?|in[íi]cio\s*(?:[àa]s)?)\s*([01]?\d|2[0-3])(?::([0-5]\d)|\s*h(?:oras?)?(?:\s*(?:e\s*)?([0-5]\d))?)(?:\s*(?:da\s+manh[ãa]|da\s+tarde|da\s+noite))?/i
  );
  if (timeMatch) {
    const parsedTime = parseSpokenTime(timeMatch[0]);
    if (parsedTime) {
      result.schedule = parsedTime;
    }
  } else {
    const directTime = parseSpokenTime(text);
    if (directTime) {
      result.schedule = directTime;
    }
  }

  // 2. Frequência / Intervalo
  if (/\b(?:se\s+necess[áa]rio|sn|dose\s+[úu]nica)\b/i.test(text)) {
    result.frequency = "";
  } else {
    const freqMatch = text.match(
      /\b(?:de|a\s+cada)\s*(\d{1,2})\s*(?:em\s*\d{1,2}\s*)?horas?\b/i
    );
    if (freqMatch) {
      const h = freqMatch[1];
      if (["4", "6", "8", "12", "24"].includes(h)) {
        result.frequency = h;
      }
    } else if (/\b4\s+vezes\s+ao\s+dia\b/i.test(text)) {
      result.frequency = "6";
    } else if (/\b3\s+vezes\s+ao\s+dia\b/i.test(text)) {
      result.frequency = "8";
    } else if (/\b2\s+vezes\s+ao\s+dia\b/i.test(text)) {
      result.frequency = "12";
    } else if (/\b(?:1\s+vez\s+ao\s+dia|uma\s+vez\s+ao\s+dia|di[áa]ri[oa])\b/i.test(text)) {
      result.frequency = "24";
    }
  }

  // 3. Observações
  const obsMatch = text.match(
    /\b(?:observa[çc][ãa]o|obs|recomenda[çc][ãa]o|diluir\s+em|correr\s+em|infundir\s+em|se\s+dor|se\s+febre|se\s+necess[áa]rio|em\s+bomba)\b\s*[:]?\s*(.*)$/i
  );
  if (obsMatch) {
    let rawObs = obsMatch[0].trim();
    if (/^se\s+necess[áa]rio\s*(?:[,;:]|\s+e|\s+se)?\s*/i.test(rawObs)) {
      rawObs = rawObs.replace(/^se\s+necess[áa]rio\s*[,;:]?\s*(?:e\s+se\s+|se\s+)?/i, "");
      rawObs = rawObs ? "Se " + rawObs : "Se necessário";
    }
    if (rawObs.length > 2) {
      result.observation = rawObs.charAt(0).toUpperCase() + rawObs.slice(1);
    }
  }

  // 4. Dose / Via
  // Dá preferência para posologia com forma farmacêutica e via (ex: "1 ampola EV", "2 comp VO", "10mg EV", "1 ampola")
  const specificDoseMatch = text.match(
    /\b(\d+(?:[.,]\d+)?\s*(?:ampola|comp|gotas?|frasco|UI|ml)\s+(?:EV|VO|SC|IM|SL|Tópica|Inalatória)|\d+\s*(?:ampola|comp|gotas?|frasco|UI)|\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml)\s*(?:EV|VO|SC|IM|SL))\b/i
  );
  if (specificDoseMatch) {
    result.dose = specificDoseMatch[1].trim();
  } else {
    const generalDoseMatch = text.match(
      /\b(\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|UI))\b/i
    );
    if (generalDoseMatch) {
      result.dose = generalDoseMatch[1].trim();
    } else {
      const routeMatch = text.match(/\b(EV|VO|SC|IM|SL)\b/);
      if (routeMatch) {
        result.dose = routeMatch[1];
      }
    }
  }

  // 5. Nome do Medicamento
  let cleanForName = text;
  cleanForName = cleanForName.replace(/^(?:prescrever|adicionar|medica[çc][ãa]o|medicamento)\s*[:]?\s*/i, "");

  // Se temos result.dose, cortamos o nome antes da dose administrada
  if (result.dose) {
    const idxDose = cleanForName.indexOf(result.dose);
    if (idxDose > 0) {
      cleanForName = cleanForName.slice(0, idxDose);
    }
  }

  const splitMatch = cleanForName.match(
    /^(.*?)(?=\s+(?:[àa]s|ás|hor[áa]rio|de\s+\d+\s+em\s+\d+|a\s+cada\s+\d+|se\s+necess[áa]rio|diluir|correr|observa[çc][ãa]o|obs)\b|$)/i
  );

  if (splitMatch && splitMatch[1].trim()) {
    let rawName = splitMatch[1].trim().replace(/^[,.\s]+|[,.\s]+$/g, "");
    if (result.dose && rawName.toLowerCase().endsWith(result.dose.toLowerCase())) {
      rawName = rawName.slice(0, -result.dose.length).trim().replace(/^[,.\s]+|[,.\s]+$/g, "");
    }
    if (rawName.length >= 2) {
      result.name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    }
  }

  return result;
}

export interface DetectedVitalSignItem {
  type: VitalSignType;
  label: string;
  value?: number;
  systolic?: number;
  diastolic?: number;
  unit: string;
}

export interface ParsedVitalSignVoiceData {
  type?: VitalSignType;
  value?: number;
  systolic?: number;
  diastolic?: number;
  rawTranscript: string;
  detectedVitals: DetectedVitalSignItem[];
}

/**
 * Converte números e expressões numéricas faladas em português para dígitos.
 * Exemplos:
 * - "trinta e seis e meio" -> "36.5"
 * - "doze por oito" -> "12 por 8"
 * - "cento e vinte por oitenta" -> "120 por 80"
 * - "noventa e oito por cento" -> "98 por cento"
 */
export function convertSpokenPortugueseNumbers(text: string): string {
  if (!text) return "";
  let res = text.toLowerCase().trim();

  // 1. Centenas compostas com dezenas/unidades
  const compoundHundreds: Record<string, string> = {
    "cento e noventa": "190",
    "cento e oitenta": "180",
    "cento e setenta": "170",
    "cento e sessenta": "160",
    "cento e cinquenta": "150",
    "cento e quarenta": "140",
    "cento e trinta": "130",
    "cento e vinte": "120",
    "cento e dez": "110",
    "cento e onze": "111",
    "cento e doze": "112",
    "cento e treze": "113",
    "cento e quatorze": "114",
    "cento e catorze": "114",
    "cento e quinze": "115",
    "cento e dezesseis": "116",
    "cento e dezessete": "117",
    "cento e dezoito": "118",
    "cento e dezenove": "119",
    "duzentos": "200",
  };
  for (const [k, v] of Object.entries(compoundHundreds)) {
    res = res.replace(new RegExp(`\\b${k}\\b`, "gi"), v);
  }

  // 2. Dezenas + unidades (ex: "trinta e seis" -> "36", "oitenta e cinco" -> "85")
  const tens: Record<string, number> = {
    vinte: 20,
    trinta: 30,
    quarenta: 40,
    cinquenta: 50,
    sessenta: 60,
    setenta: 70,
    oitenta: 80,
    noventa: 90,
  };
  const units: Record<string, number> = {
    um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4,
    cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  };

  for (const [tWord, tVal] of Object.entries(tens)) {
    for (const [uWord, uVal] of Object.entries(units)) {
      const phrase = `${tWord} e ${uWord}`;
      res = res.replace(new RegExp(`\\b${phrase}\\b`, "gi"), String(tVal + uVal));
    }
  }

  // 3. "X e meio / meia" -> "X.5" (ex: "36 e meio" -> "36.5", "13 e meio" -> "13.5", "8 e meio" -> "8.5")
  res = res.replace(/\b(\d+(?:[.,]\d+)?)\s+e\s+(?:meio|meia)\b/gi, "$1.5");

  // 4. "vírgula" ou "ponto" falado: "36 vírgula 8" -> "36.8", "37 ponto 2" -> "37.2"
  res = res.replace(/\b(\d+)\s*(?:v[íi]rgula|ponto)\s*(\d+)\b/gi, "$1.$2");

  // 5. Temperatura falada tipo "37 e 8" (35-42 seguido de "e dígito")
  res = res.replace(/\b(3[4-9]|4[0-2])\s+e\s+([0-9])\b/gi, "$1.$2");

  // 6. Números individuais por extenso
  const singleNumbers: Record<string, string> = {
    zero: "0",
    um: "1", uma: "1",
    dois: "2", duas: "2",
    tres: "3", três: "3",
    quatro: "4",
    cinco: "5",
    seis: "6",
    sete: "7",
    oito: "8",
    nove: "9",
    dez: "10",
    onze: "11",
    doze: "12",
    treze: "13",
    quatorze: "14", catorze: "14",
    quinze: "15",
    dezesseis: "16",
    dezessete: "17",
    dezoito: "18",
    dezenove: "19",
    vinte: "20",
    trinta: "30",
    quarenta: "40",
    cinquenta: "50",
    sessenta: "60",
    setenta: "70",
    oitenta: "80",
    noventa: "90",
    cem: "100", cento: "100",
  };

  for (const [w, n] of Object.entries(singleNumbers)) {
    res = res.replace(new RegExp(`\\b${w}\\b`, "gi"), n);
  }

  // Decimal após substituição de números por extenso
  res = res.replace(/\b(\d+)\s*(?:v[íi]rgula|ponto)\s*(\d+)\b/gi, "$1.$2");
  res = res.replace(/\b(3[4-9]|4[0-2])\s+e\s+([0-9])\b/gi, "$1.$2");

  return res;
}

/**
 * Normaliza valores de pressão arterial falados em formato padrão hospitalar no Brasil.
 * Exemplos:
 * - "12 por 8" -> 120 / 80 mmHg
 * - "13 por 8.5" -> 130 / 85 mmHg
 * - "120 por 80" -> 120 / 80 mmHg
 */
function normalizeBpValues(rawSys: number, rawDia: number): { systolic: number; diastolic: number } {
  let sys = rawSys;
  let dia = rawDia;

  // Se o profissional falou "12 por 8" ou "13 por 8.5"
  if (sys <= 25) {
    sys = Math.round(sys * 10);
  }
  if (dia <= 15) {
    dia = Math.round(dia * 10);
  }

  return { systolic: sys, diastolic: dia };
}

/**
 * Analisa a fala quando direcionada a um parâmetro clínico específico.
 */
export function parseSingleVitalValue(
  type: VitalSignType,
  transcript: string
): { value?: number; systolic?: number; diastolic?: number } | null {
  if (!transcript || !transcript.trim()) return null;

  const normalized = convertSpokenPortugueseNumbers(transcript);

  switch (type) {
    case "PRESSAO_ARTERIAL": {
      const match = normalized.match(/(\d{1,3}(?:\.\d+)?)\s*(?:x|\/|por|sobre|\-|\s+)\s*(\d{1,3}(?:\.\d+)?)/i);
      if (match) {
        const rawSys = parseFloat(match[1]);
        const rawDia = parseFloat(match[2]);
        if (!isNaN(rawSys) && !isNaN(rawDia) && rawSys > 0 && rawDia > 0) {
          return normalizeBpValues(rawSys, rawDia);
        }
      }
      return null;
    }

    case "TEMPERATURA": {
      const match = normalized.match(/(\d{2}(?:\.\d+)?)/);
      if (match) {
        const val = parseFloat(match[1]);
        if (!isNaN(val) && val >= 25 && val <= 45) {
          return { value: val };
        }
      }
      return null;
    }

    case "FREQUENCIA_CARDIACA": {
      const match = normalized.match(/(\d{2,3})/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val >= 20 && val <= 260) {
          return { value: val };
        }
      }
      return null;
    }

    case "FREQUENCIA_RESPIRATORIA": {
      const match = normalized.match(/(\d{1,2})/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val >= 4 && val <= 70) {
          return { value: val };
        }
      }
      return null;
    }

    case "SATURACAO_O2": {
      const match = normalized.match(/(\d{2,3})/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val >= 40 && val <= 100) {
          return { value: val };
        }
      }
      return null;
    }

    case "GLICEMIA": {
      const match = normalized.match(/(\d{2,3})/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val >= 20 && val <= 700) {
          return { value: val };
        }
      }
      return null;
    }

    case "ESCALA_DE_DOR": {
      if (/\b(?:sem\s+dor|dor\s+zero|zero|nenhuma|ausente)\b/i.test(normalized)) {
        return { value: 0 };
      }
      if (/\b(?:dor\s+)?leve\b/i.test(normalized)) {
        return { value: 2 };
      }
      if (/\b(?:dor\s+)?moderada\b/i.test(normalized)) {
        return { value: 5 };
      }
      if (/\b(?:dor\s+)?(?:intensa|forte)\b/i.test(normalized)) {
        return { value: 8 };
      }
      if (/\b(?:dor\s+)?(?:insuport[áa]vel|m[áa]xima)\b/i.test(normalized)) {
        return { value: 10 };
      }
      const match = normalized.match(/\b([0-9]|10)\b/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val >= 0 && val <= 10) {
          return { value: val };
        }
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Analisa a fala livre de sinais vitais, detectando o tipo e os valores correspondentes.
 * Suporta ditado de um sinal ou múltiplos sinais combinados.
 */
export function parseVitalSignsVoiceInput(
  transcript: string,
  fallbackType?: VitalSignType
): ParsedVitalSignVoiceData {
  const result: ParsedVitalSignVoiceData = {
    rawTranscript: transcript,
    detectedVitals: [],
  };

  if (!transcript || !transcript.trim()) return result;

  const normalized = convertSpokenPortugueseNumbers(transcript);

  // 1. Pressão Arterial
  // Exemplos: "pressão 12 por 8", "pa 120 por 80", "pressão arterial 13 por 8 e meio", "12 por 8"
  const bpExplicitMatch = normalized.match(
    /\b(?:press[ãa]o(?:\s+arterial)?|pa)\b[^\d]*(\d{1,3}(?:\.\d+)?)\s*(?:x|\/|por|sobre|\-|\s+)\s*(\d{1,3}(?:\.\d+)?)/i
  );
  const bpPatternMatch = normalized.match(
    /\b(\d{1,2}(?:\.\d+)?)\s*(?:x|\/|por|sobre)\s*(\d{1,2}(?:\.\d+)?)\b/i
  ) || normalized.match(
    /\b(\d{2,3})\s*(?:x|\/|por|sobre)\s*(\d{2,3})\b/i
  );

  const bpMatch = bpExplicitMatch || (fallbackType === "PRESSAO_ARTERIAL" || /\bpress[ãa]o\b/i.test(normalized) ? bpPatternMatch : null);

  if (bpMatch) {
    const rawSys = parseFloat(bpMatch[1]);
    const rawDia = parseFloat(bpMatch[2]);
    if (!isNaN(rawSys) && !isNaN(rawDia)) {
      const { systolic, diastolic } = normalizeBpValues(rawSys, rawDia);
      result.detectedVitals.push({
        type: "PRESSAO_ARTERIAL",
        label: "Pressão Arterial",
        systolic,
        diastolic,
        unit: "mmHg",
      });
    }
  }

  // 2. Temperatura
  // Exemplos: "temperatura 36 e meio", "temp 37.8", "37 e meio graus"
  const tempMatch = normalized.match(
    /\b(?:temperatura(?:\s+axilar)?|temp|febril)\b[^\d]*(3[4-9]|4[0-3])(?:[.,](\d{1,2}))?/i
  ) || normalized.match(
    /\b(3[4-9]|4[0-3])(?:[.,](\d{1,2}))?\s*(?:graus|°c|c\b)/i
  );

  if (tempMatch) {
    const intPart = tempMatch[1];
    const decPart = tempMatch[2] || "0";
    const tempVal = parseFloat(`${intPart}.${decPart}`);
    if (!isNaN(tempVal)) {
      result.detectedVitals.push({
        type: "TEMPERATURA",
        label: "Temperatura",
        value: tempVal,
        unit: "°C",
      });
    }
  }

  // 3. Frequência Cardíaca
  // Exemplos: "frequência cardíaca 78", "pulso 80", "fc 75", "80 bpm"
  const fcMatch = normalized.match(
    /\b(?:frequ[êe]ncia\s+card[íi]aca|freq\s+card[íi]aca|pulso|fc|batimentos)\b[^\d]*(\d{2,3})/i
  ) || normalized.match(
    /\b(\d{2,3})\s*bpm\b/i
  );

  if (fcMatch) {
    const fcVal = parseInt(fcMatch[1], 10);
    if (!isNaN(fcVal) && fcVal >= 25 && fcVal <= 260) {
      result.detectedVitals.push({
        type: "FREQUENCIA_CARDIACA",
        label: "Frequência Cardíaca",
        value: fcVal,
        unit: "bpm",
      });
    }
  }

  // 4. Frequência Respiratória
  // Exemplos: "frequência respiratória 18", "fr 16", "respiração 20", "18 irpm"
  const frMatch = normalized.match(
    /\b(?:frequ[êe]ncia\s+respirat[óo]ria|freq\s+respirat[óo]ria|fr|respira[çc][ãa]o|movimentos\s+respirat[óo]rios)\b[^\d]*(\d{1,2})/i
  ) || normalized.match(
    /\b(\d{1,2})\s*(?:irpm|mrpm|rpm)\b/i
  );

  if (frMatch) {
    const frVal = parseInt(frMatch[1], 10);
    if (!isNaN(frVal) && frVal >= 4 && frVal <= 65) {
      result.detectedVitals.push({
        type: "FREQUENCIA_RESPIRATORIA",
        label: "Frequência Respiratória",
        value: frVal,
        unit: "irpm",
      });
    }
  }

  // 5. Saturação O₂
  // Exemplos: "saturação 98", "spo2 97", "sat 99", "98 por cento de oxigênio"
  const satMatch = normalized.match(
    /\b(?:satura[çc][ãa]o(?:\s+(?:de\s+)?oxig[êe]nio|\s+o2)?|spo2|sat)\b[^\d]*(\d{2,3})/i
  ) || normalized.match(
    /\b(\d{2,3})\s*(?:%|por\s*cento)\b/i
  );

  if (satMatch) {
    const satVal = parseInt(satMatch[1], 10);
    if (!isNaN(satVal) && satVal >= 50 && satVal <= 100) {
      result.detectedVitals.push({
        type: "SATURACAO_O2",
        label: "Saturação O₂",
        value: satVal,
        unit: "%",
      });
    }
  }

  // 6. Glicemia Capilar
  // Exemplos: "glicemia 110", "hgt 95", "glicose 140", "destro 125"
  const glycMatch = normalized.match(
    /\b(?:glicemia(?:\s+capilar)?|hgt|glicose|destro)\b[^\d]*(\d{2,3})/i
  );

  if (glycMatch) {
    const glycVal = parseInt(glycMatch[1], 10);
    if (!isNaN(glycVal) && glycVal >= 20 && glycVal <= 700) {
      result.detectedVitals.push({
        type: "GLICEMIA",
        label: "Glicemia",
        value: glycVal,
        unit: "mg/dL",
      });
    }
  }

  // 7. Escala de Dor
  // Exemplos: "dor 3", "escala de dor 0", "eva 5", "sem dor", "dor moderada"
  const painTrigger = /\b(?:escala\s+de\s+dor|dor|eva|n[íi]vel\s+de\s+dor)\b/i.test(normalized);
  if (painTrigger) {
    let painVal: number | undefined;
    if (/\b(?:sem\s+dor|dor\s+zero|nenhuma|ausente)\b/i.test(normalized)) {
      painVal = 0;
    } else if (/\b(?:dor\s+)?leve\b/i.test(normalized)) {
      painVal = 2;
    } else if (/\b(?:dor\s+)?moderada\b/i.test(normalized)) {
      painVal = 5;
    } else if (/\b(?:dor\s+)?(?:intensa|forte)\b/i.test(normalized)) {
      painVal = 8;
    } else if (/\b(?:dor\s+)?(?:insuport[áa]vel|m[áa]xima)\b/i.test(normalized)) {
      painVal = 10;
    } else {
      const match = normalized.match(/\b(?:dor|eva|escala\s+de\s+dor)\b[^\d]*([0-9]|10)\b/i);
      if (match) {
        painVal = parseInt(match[1], 10);
      }
    }

    if (painVal !== undefined && !isNaN(painVal)) {
      result.detectedVitals.push({
        type: "ESCALA_DE_DOR",
        label: "Escala de Dor",
        value: painVal,
        unit: "0-10",
      });
    }
  }

  // Se nenhum sinal vital foi detectado por palavras-chave, mas temos um fallbackType (ex: o usuário já selecionou Temperatura ou clicou no microfone do campo)
  if (result.detectedVitals.length === 0 && fallbackType) {
    const single = parseSingleVitalValue(fallbackType, transcript);
    if (single) {
      result.detectedVitals.push({
        type: fallbackType,
        label: fallbackType,
        value: single.value,
        systolic: single.systolic,
        diastolic: single.diastolic,
        unit: "",
      });
    }
  }

  // Define as propriedades de topo se houver ao menos um sinal detectado
  if (result.detectedVitals.length > 0) {
    const primary = result.detectedVitals[0];
    result.type = primary.type;
    result.value = primary.value;
    result.systolic = primary.systolic;
    result.diastolic = primary.diastolic;
  }

  return result;
}

