export type LowthianPositionCode = "DLD" | "DD" | "DLE" | "FOWLER" | "DV";

export interface LowthianPositionInfo {
  code: LowthianPositionCode;
  name: string;
  shortName: string;
  abbreviation: string;
  angle: string;
  description: string;
  cushions: string;
  relievedAreas: string[];
  atRiskAreas: string[];
  color: {
    badge: string;
    border: string;
    bg: string;
    text: string;
    fillHex: string;
    strokeHex: string;
  };
}

export const LOWTHIAN_POSITIONS: Record<LowthianPositionCode, LowthianPositionInfo> = {
  DLD: {
    code: "DLD",
    name: "Decúbito Lateral Direito",
    shortName: "Lat. Direito (30°)",
    abbreviation: "DLD 30°",
    angle: "Inclinação de 30°",
    description: "Paciente posicionado sobre o lado direito com inclinação máxima de 30° em relação ao colchão.",
    cushions: "Coxim sob o dorso/flanco esquerdo, travesseiro entre os joelhos e maléolos levemente desfasados. Braço direito livre de compressão.",
    relievedAreas: ["Sacro", "Cóccix", "Calcanhares", "Trocânter esquerdo", "Ombro esquerdo"],
    atRiskAreas: ["Trocânter direito", "Maléolo lateral direito", "Orelha direita", "Ombro direito"],
    color: {
      badge: "bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 border-sky-200 dark:border-sky-800",
      border: "border-sky-300 dark:border-sky-700",
      bg: "bg-sky-50 dark:bg-sky-950/40",
      text: "text-sky-700 dark:text-sky-400",
      fillHex: "#0284c7",
      strokeHex: "#0369a1",
    },
  },
  DD: {
    code: "DD",
    name: "Decúbito Dorsal (Supina)",
    shortName: "Dorsal (Supina)",
    abbreviation: "DD (Supina)",
    angle: "0° a 30° cabeceira",
    description: "Paciente deitado de costas, com alinhamento da coluna e membros inferiores levemente fletidos.",
    cushions: "Coxim sob a panturrilha para flutuação completa dos calcanhares (livres do colchão). Pequeno coxim na região lombar se tolerado.",
    relievedAreas: ["Trocânteres bilaterais", "Orelhas", "Maléolos laterais"],
    atRiskAreas: ["Região sacrococcígea", "Calcanhares", "Escápulas", "Occipício", "Cotovelos"],
    color: {
      badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
      border: "border-emerald-300 dark:border-emerald-700",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      text: "text-emerald-700 dark:text-emerald-400",
      fillHex: "#059669",
      strokeHex: "#047857",
    },
  },
  DLE: {
    code: "DLE",
    name: "Decúbito Lateral Esquerdo",
    shortName: "Lat. Esquerdo (30°)",
    abbreviation: "DLE 30°",
    angle: "Inclinação de 30°",
    description: "Paciente posicionado sobre o lado esquerdo com inclinação máxima de 30° em relação ao colchão.",
    cushions: "Coxim sob o dorso/flanco direito, travesseiro entre os joelhos e maléolos levemente desfasados. Braço esquerdo protegido.",
    relievedAreas: ["Sacro", "Cóccix", "Calcanhares", "Trocânter direito", "Ombro direito"],
    atRiskAreas: ["Trocânter esquerdo", "Maléolo lateral esquerdo", "Orelha esquerda", "Ombro esquerdo"],
    color: {
      badge: "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800",
      border: "border-purple-300 dark:border-purple-700",
      bg: "bg-purple-50 dark:bg-purple-950/40",
      text: "text-purple-700 dark:text-purple-400",
      fillHex: "#7c3aed",
      strokeHex: "#6d28d9",
    },
  },
  FOWLER: {
    code: "FOWLER",
    name: "Posição de Fowler / Semi-Fowler",
    shortName: "Semi-Fowler (30°)",
    abbreviation: "Semi-Fowler",
    angle: "Cabeceira elevada 30° a 45°",
    description: "Paciente semi-sentado com cabeceira elevada a 30° (máx 45° durante dieta) e leve flexão dos joelhos.",
    cushions: "Coxim sob as coxas para evitar deslizamento (força de cisalhamento sacral) e almofada elevando os calcanhares.",
    relievedAreas: ["Trocânteres", "Occipício", "Vias aéreas (melhora ventilação)"],
    atRiskAreas: ["Tuberosidades isquiáticas", "Sacro", "Calcanhares"],
    color: {
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800",
      border: "border-amber-300 dark:border-amber-700",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-700 dark:text-amber-400",
      fillHex: "#d97706",
      strokeHex: "#b45309",
    },
  },
  DV: {
    code: "DV",
    name: "Decúbito Ventral (Prona)",
    shortName: "Prona (Ventral)",
    abbreviation: "Prona",
    angle: "0° alinhado",
    description: "Paciente deitado sobre o abdômen com a face lateralizada e alinhamento do tórax e pelve.",
    cushions: "Coxins sob a cintura escapular e pelve (alívio do abdômen e mamas). Apoio sob os dorsos dos pés para livrar os dedos.",
    relievedAreas: ["Toda a região dorsal", "Sacro", "Glúteos", "Calcanhares"],
    atRiskAreas: ["Bochechas", "Mento", "Ombros anteriores", "Cristas ilíacas", "Joelhos", "Dorço dos pés"],
    color: {
      badge: "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800",
      border: "border-rose-300 dark:border-rose-700",
      bg: "bg-rose-50 dark:bg-rose-950/40",
      text: "text-rose-700 dark:text-rose-400",
      fillHex: "#e11d48",
      strokeHex: "#be123c",
    },
  },
};

export interface LowthianProtocol {
  id: string;
  name: string;
  shortName: string;
  description: string;
  sequence: LowthianPositionCode[];
  recommendedIntervalHours: number;
}

export const LOWTHIAN_PROTOCOLS: LowthianProtocol[] = [
  {
    id: "classic",
    name: "Clássico de Lowthian (Padrão Ouro)",
    shortName: "Clássico Lowthian",
    description: "Alternância rotativa a cada 2 horas: Lateral Direito (30°) → Dorsal → Lateral Esquerdo (30°) → Dorsal.",
    sequence: ["DLD", "DD", "DLE", "DD"],
    recommendedIntervalHours: 2,
  },
  {
    id: "fowler",
    name: "Protocolo Respiratório / Fowler",
    shortName: "Com Semi-Fowler",
    description: "Indicado para pacientes em ventilação ou com refluxo: Lateral Direito → Semi-Fowler → Lateral Esquerdo → Dorsal.",
    sequence: ["DLD", "FOWLER", "DLE", "DD"],
    recommendedIntervalHours: 2,
  },
  {
    id: "lateral_strict",
    name: "Laterais Estritas (Alívio Sacral Total)",
    shortName: "Laterais Estritas",
    description: "Alternância bilateral estrita a 30° para pacientes com lesão por pressão existente em região sacral ou coccígea.",
    sequence: ["DLD", "DLE"],
    recommendedIntervalHours: 2,
  },
  {
    id: "complete_5",
    name: "Completo 4 Posições Rotativas",
    shortName: "Rotativo Completo",
    description: "Lateral Direito (30°) → Dorsal → Lateral Esquerdo (30°) → Semi-Fowler.",
    sequence: ["DLD", "DD", "DLE", "FOWLER"],
    recommendedIntervalHours: 2,
  },
];

export interface LowthianScheduleItem {
  id: string;
  index: number;
  startTime: string;       // "08:00"
  endTime: string;         // "10:00"
  startMinutesOfDay: number; // 480
  endMinutesOfDay: number;   // 600
  durationMinutes: number;   // 120
  position: LowthianPositionInfo;
  instructions: string;
  executed?: boolean;
}

export interface GenerateScheduleOptions {
  startHour?: number;        // 0..23 (default: 8)
  startMinute?: number;      // 0..59 (default: 0)
  intervalHours?: number;    // 1.5, 2, 3, 4 (default: 2)
  protocolId?: string;       // default: "classic"
  totalHours?: number;       // default: 24
}

/**
 * Converte minutos do dia (0 a 1439) em string "HH:mm"
 */
export function formatMinutesToTime(minutes: number): string {
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60).toString().padStart(2, "0");
  const m = Math.floor(norm % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Converte string "HH:mm" em minutos do dia (0 a 1439)
 */
export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  const h = parseInt(parts[0] || "0", 10);
  const m = parseInt(parts[1] || "0", 10);
  return (h * 60 + m) % 1440;
}

/**
 * Gera o cronograma completo de 24 horas do Relógio de Lowthian
 */
export function generateLowthianSchedule(options: GenerateScheduleOptions = {}): LowthianScheduleItem[] {
  const {
    startHour = 8,
    startMinute = 0,
    intervalHours = 2,
    protocolId = "classic",
    totalHours = 24,
  } = options;

  const protocol = LOWTHIAN_PROTOCOLS.find((p) => p.id === protocolId) || LOWTHIAN_PROTOCOLS[0];
  const intervalMinutes = Math.round(intervalHours * 60);
  const totalSlots = Math.max(1, Math.round((totalHours * 60) / intervalMinutes));

  const items: LowthianScheduleItem[] = [];
  const baseStart = (startHour * 60 + startMinute) % 1440;

  for (let i = 0; i < totalSlots; i++) {
    const slotStartMin = (baseStart + i * intervalMinutes) % 1440;
    const slotEndMin = (slotStartMin + intervalMinutes) % 1440;
    const posCode = protocol.sequence[i % protocol.sequence.length];
    const posInfo = LOWTHIAN_POSITIONS[posCode] || LOWTHIAN_POSITIONS.DD;

    items.push({
      id: `lowthian-slot-${i}`,
      index: i,
      startTime: formatMinutesToTime(slotStartMin),
      endTime: formatMinutesToTime(slotEndMin),
      startMinutesOfDay: slotStartMin,
      endMinutesOfDay: slotEndMin,
      durationMinutes: intervalMinutes,
      position: posInfo,
      instructions: `${posInfo.angle}. ${posInfo.cushions}`,
    });
  }

  return items;
}

export interface CurrentSlotStatus {
  currentSlot: LowthianScheduleItem;
  nextSlot: LowthianScheduleItem;
  minutesRemaining: number;
  minutesElapsed: number;
  progressPercent: number;
}

/**
 * Determina o decúbito em vigência e a próxima troca a partir do horário atual
 */
export function getCurrentLowthianSlot(
  schedule: LowthianScheduleItem[],
  now: Date = new Date()
): CurrentSlotStatus | null {
  if (!schedule || schedule.length === 0) return null;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Encontra o slot cujo intervalo cobre currentMinutes
  let activeIndex = 0;

  for (let i = 0; i < schedule.length; i++) {
    const s = schedule[i];
    if (s.startMinutesOfDay < s.endMinutesOfDay) {
      if (currentMinutes >= s.startMinutesOfDay && currentMinutes < s.endMinutesOfDay) {
        activeIndex = i;
        break;
      }
    } else {
      // Cruzou meia-noite (ex: 22:00 até 00:00 ou 23:00 até 01:00)
      if (currentMinutes >= s.startMinutesOfDay || currentMinutes < s.endMinutesOfDay) {
        activeIndex = i;
        break;
      }
    }
  }

  const currentSlot = schedule[activeIndex];
  const nextSlot = schedule[(activeIndex + 1) % schedule.length];

  // Calcula minutos transcorridos e restantes
  let minutesElapsed = 0;
  if (currentMinutes >= currentSlot.startMinutesOfDay) {
    minutesElapsed = currentMinutes - currentSlot.startMinutesOfDay;
  } else {
    // Cruzou a meia-noite
    minutesElapsed = (1440 - currentSlot.startMinutesOfDay) + currentMinutes;
  }

  const minutesRemaining = Math.max(0, currentSlot.durationMinutes - minutesElapsed);
  const progressPercent = Math.min(100, Math.max(0, Math.round((minutesElapsed / currentSlot.durationMinutes) * 100)));

  return {
    currentSlot,
    nextSlot,
    minutesRemaining,
    minutesElapsed,
    progressPercent,
  };
}

export interface PrescriptionFormatOptions {
  patientName?: string;
  bed?: string;
  intervalHours: number;
  protocolName: string;
  schedule: LowthianScheduleItem[];
  notes?: string;
}

/**
 * Formata o plano de decúbito de Lowthian para prontuário/evolução de enfermagem
 */
export function formatLowthianPrescription(options: PrescriptionFormatOptions): string {
  const {
    patientName = "Não informado",
    bed = "Não informado",
    intervalHours,
    protocolName,
    schedule,
    notes,
  } = options;

  const dateStr = new Date().toLocaleDateString("pt-BR");
  const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  let text = `=======================================================\n`;
  text += `PRESCRIÇÃO DE ENFERMAGEM: RELÓGIO DE LOWTHIAN (MUDANÇA DE DECÚBITO)\n`;
  text += `=======================================================\n`;
  text += `Data: ${dateStr} às ${timeStr}\n`;
  text += `Paciente: ${patientName} | Leito: ${bed}\n`;
  text += `Protocolo: ${protocolName}\n`;
  text += `Intervalo: A cada ${intervalHours}h (ciclo 24 horas)\n`;
  text += `Objetivo: Prevenção de Lesões por Pressão (LPP) • Protocolo Lowthian\n\n`;
  text += `CRONOGRAMA DE MUDANÇA DE DECÚBITO:\n`;

  schedule.forEach((s) => {
    text += `• ${s.startTime} às ${s.endTime} — ${s.position.name} (${s.position.angle})\n`;
    text += `  Orientação: ${s.position.cushions}\n`;
  });

  text += `\nCUIDADOS DE ENFERMAGEM OBRIGATÓRIOS:\n`;
  text += `1. Regra dos 30°: Nunca posicionar o paciente a 90° sobre o trocânter maior.\n`;
  text += `2. Alívio de calcâneos: Manter calcanhares suspensos livres do colchão.\n`;
  text += `3. Proeminências ósseas: Usar coxins entre joelhos e maléolos desfasados.\n`;
  text += `4. Cabeceira: Manter em até 30° para evitar cisalhamento sacrococcígeo.\n`;
  text += `5. Avaliação da pele: Inspecionar hiperemia não reativa a cada manobra.\n`;

  if (notes) {
    text += `\nOBSERVAÇÕES INDIVIDUALIZADAS:\n${notes}\n`;
  }

  text += `=======================================================`;
  return text;
}
