/**
 * Verificador de Alergias e Contraindicações de Medicações
 * Garante segurança clínica ao impedir o cadastro ou prescrição de fármacos
 * aos quais o paciente tem registro de alergia no seu Quadro Clínico.
 */

export interface AllergyConflictResult {
  hasConflict: boolean;
  matchedTerm?: string;
  rawAllergyText?: string;
  source?: "allergies" | "diagnosis";
  message?: string;
}

export interface PatientAllergyInfo {
  allergies?: string | null;
  diagnosis?: string | null;
}

/**
 * Remove acentos, pontuações desnecessárias e normaliza para minúsculas
 */
function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Remove pontuação de escape para expressões regulares
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Termos comuns que indicam AUSÊNCIA de alergia e devem ser desconsiderados
 */
const NEGATIVE_ALLERGY_PATTERNS = [
  /^nega(\s+alergias?)?/i,
  /^sem\s+alergias?/i,
  /^nenhuma(\s+relatada)?/i,
  /^n[ãa]o\s+(possui|tem|relatad[ao]|conhecid[ao]|informad[ao])/i,
  /^desconhecid[ao]/i,
  /^nada\s+relatad[ao]/i,
  /^nao$/i,
  /^nenhum$/i,
  /^nenhuma$/i,
  /^limpo$/i,
];

/**
 * Termos farmacológicos secundários a ignorar na extração do princípio ativo
 * (ex: vias, formas farmacêuticas, números e unidades)
 */
const COMMON_DRUG_STOPWORDS = new Set([
  "mg", "g", "ml", "mcg", "ui", "cp", "comp", "comprimido", "comprimidos",
  "ampola", "ampolas", "frasco", "gotas", "gt", "gts", "dose", "doses",
  "iv", "ev", "vo", "im", "sc", "sl", "injetavel", "oral", "topico",
  "solucao", "suspensao", "xarope", "creme", "pomada", "spray",
  "via", "de", "em", "para", "com", "ao", "aos", "as", "por",
  "1x", "2x", "3x", "4x", "1", "2", "3", "4", "5", "6", "8", "12", "24"
]);

/**
 * Extrai a lista de substâncias/alergias individuais de um texto
 */
export function extractAllergyTerms(rawAllergies: string): string[] {
  if (!rawAllergies || !rawAllergies.trim()) return [];

  // Se o texto inteiro é uma negação de alergias, ignora
  const trimmed = rawAllergies.trim();
  for (const pattern of NEGATIVE_ALLERGY_PATTERNS) {
    if (pattern.test(trimmed)) return [];
  }

  // Divide por delimitadores usuais (vírgula, ponto-e-vírgula, barras, ' e ', ' ou ')
  const chunks = trimmed.split(/[,;\/\n\+]|\s+(?:e|ou)\s+/i);
  const terms: string[] = [];

  for (let chunk of chunks) {
    chunk = chunk.trim();
    if (!chunk) continue;

    // Remove prefixos comuns como "alergia a", "alérgica a", "alérgico a", etc.
    let cleaned = chunk.replace(
      /^(?:alergias?\s*(?:a|ao|aos|à|às|de)?|al[ée]rgic[oa]\s*(?:a|ao|aos|à|às)?|rea[çc][ãa]o\s*(?:a|ao|aos|à|às)?|hipersensibilidade\s*(?:a|ao|aos|à|às)?|intoler[âa]ncia\s*(?:a|ao|aos|à|às)?|choque\s+anafil[áa]tico\s*(?:a|ao|aos|à|às|por)?)\s*/i,
      ""
    ).trim();

    // Remove pontuações finais ou iniciais
    cleaned = cleaned.replace(/^[^a-zA-Z0-9À-ÖØ-öø-ÿ]+|[^a-zA-Z0-9À-ÖØ-öø-ÿ]+$/g, "").trim();

    if (!cleaned) continue;

    // Verifica se este fragmento específico não é apenas uma negação
    let isNeg = false;
    for (const pattern of NEGATIVE_ALLERGY_PATTERNS) {
      if (pattern.test(cleaned)) {
        isNeg = true;
        break;
      }
    }
    if (isNeg) continue;

    if (cleaned.length >= 2) {
      terms.push(cleaned);
    }
  }

  return terms;
}

/**
 * Extrai alergias mencionadas dentro do campo de diagnóstico/quadro clínico
 */
export function extractAllergiesFromDiagnosis(diagnosis: string): string[] {
  if (!diagnosis || !diagnosis.trim()) return [];
  const results: string[] = [];

  // Padrões como "alergia a penicilina", "alérgico a dipirona", "choque por contraste"
  const allergyRegex = /(?:alergia(?:s)?|al[ée]rgic[oa]|rea[çc][ãa]o\s+al[ée]rgica|hipersensibilidade|choque\s+anafil[áa]tico|anafilaxia)\s*(?:a|ao|aos|à|às|por)?\s*([A-Za-zÀ-ÖØ-öø-ÿ0-9\s,\/\-]+?)(?=[.;,]|\bcom\b|\be\s+outr[ao]s?\b|$)/gi;

  let match;
  while ((match = allergyRegex.exec(diagnosis)) !== null) {
    const rawMatch = match[1]?.trim();
    if (rawMatch) {
      const extracted = extractAllergyTerms(rawMatch);
      results.push(...extracted);
    }
  }

  return results;
}

/**
 * Extrai os termos principais de um nome de medicação
 * (ex: "Dipirona 500mg/ml IV" -> ["dipirona"])
 */
export function extractDrugKeywords(medicationName: string): string[] {
  if (!medicationName || !medicationName.trim()) return [];

  const normalized = normalizeText(medicationName);
  // Divide em palavras
  const words = normalized.split(/[^a-z0-9]+/);

  return words.filter((w) => {
    if (w.length < 2) return false;
    if (/^\d+$/.test(w)) return false; // apenas números
    if (/^\d+(mg|g|ml|mcg|ui|cp|gt|gts)$/.test(w)) return false; // dose ex 500mg
    if (COMMON_DRUG_STOPWORDS.has(w)) return false;
    return true;
  });
}

/**
 * Verifica se uma medicação colide com os registros de alergia do paciente.
 * Retorna AllergyConflictResult informando se há bloqueio e o motivo.
 */
export function checkMedicationAllergyConflict(
  medicationName: string,
  patient?: PatientAllergyInfo | null
): AllergyConflictResult {
  if (!medicationName || !medicationName.trim() || !patient) {
    return { hasConflict: false };
  }

  const rawMedName = medicationName.trim();
  const normalizedMed = normalizeText(rawMedName);
  const drugKeywords = extractDrugKeywords(rawMedName);

  // 1. Termos de alergia explícitos no campo de Alergias
  const allergyTerms = extractAllergyTerms(patient.allergies || "");

  // 2. Termos de alergia encontrados no campo de Diagnóstico / Quadro Clínico
  const diagnosisAllergies = extractAllergiesFromDiagnosis(patient.diagnosis || "");

  const allCandidateTerms: { term: string; source: "allergies" | "diagnosis" }[] = [
    ...allergyTerms.map((t) => ({ term: t, source: "allergies" as const })),
    ...diagnosisAllergies.map((t) => ({ term: t, source: "diagnosis" as const })),
  ];

  if (allCandidateTerms.length === 0) {
    return { hasConflict: false };
  }

  for (const { term, source } of allCandidateTerms) {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm || normalizedTerm.length < 2) continue;

    const escapedTerm = escapeRegExp(normalizedTerm);

    // Caso A: O nome da medicação contém o termo de alergia como palavra ou expressão
    // Ex: "Dipirona 500mg" contém "dipirona"
    const termWordRegex = new RegExp(`(^|\\b|\\s)${escapedTerm}(\\b|\\s|$)`, "i");
    if (termWordRegex.test(normalizedMed)) {
      return {
        hasConflict: true,
        matchedTerm: term,
        rawAllergyText: source === "allergies" ? patient.allergies || term : patient.diagnosis || term,
        source,
        message: `O paciente possui registro de alergia a "${term}" no seu Quadro Clínico (${source === "allergies" ? "Alergias" : "Diagnóstico"}). A prescrição desta medicação está bloqueada por segurança.`,
      };
    }

    // Caso B: O termo de alergia é composto e contém uma das palavras-chave do remédio
    // Ex: Alergia = "Dipirona sódica", Medicação = "Dipirona"
    for (const drugWord of drugKeywords) {
      if (drugWord.length < 3) continue; // evita falsos positivos curtos
      const drugWordRegex = new RegExp(`(^|\\b|\\s)${escapeRegExp(drugWord)}(\\b|\\s|$)`, "i");
      if (drugWordRegex.test(normalizedTerm)) {
        return {
          hasConflict: true,
          matchedTerm: term,
          rawAllergyText: source === "allergies" ? patient.allergies || term : patient.diagnosis || term,
          source,
          message: `O paciente possui registro de alergia a "${term}" no seu Quadro Clínico (${source === "allergies" ? "Alergias" : "Diagnóstico"}). A prescrição desta medicação está bloqueada por segurança.`,
        };
      }
    }

    // Caso C: Se o termo de alergia tiver 4 ou mais caracteres e um contiver o outro diretamente
    if (normalizedTerm.length >= 4) {
      if (normalizedMed.includes(normalizedTerm) || (drugKeywords.length > 0 && normalizedTerm.includes(drugKeywords[0]))) {
        return {
          hasConflict: true,
          matchedTerm: term,
          rawAllergyText: source === "allergies" ? patient.allergies || term : patient.diagnosis || term,
          source,
          message: `O paciente possui registro de alergia a "${term}" no seu Quadro Clínico (${source === "allergies" ? "Alergias" : "Diagnóstico"}). A prescrição desta medicação está bloqueada por segurança.`,
        };
      }
    }
  }

  return { hasConflict: false };
}
