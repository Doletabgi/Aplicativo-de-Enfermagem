import { type TodayMedication } from "@/lib/localdb";

export type MedStatus = "administrado" | "atrasado" | "pendente";

/**
 * Converte o horário de schedule (ex: "08:00", "2026-09-08 08:00", "2026-09-08T08:00")
 * para um objeto Date. Se houver data explícita no schedule, utiliza essa data;
 * caso contrário, assume a data de `referenceDate`.
 */
export function parseScheduleDate(schedule: string, referenceDate: Date = new Date()): Date {
  const schedStr = schedule ? schedule.trim() : "00:00";
  let datePart: string | null = null;
  let timePart = schedStr;

  if (schedStr.includes("T")) {
    const parts = schedStr.split("T");
    datePart = parts[0];
    timePart = parts[1] || "00:00";
  } else if (schedStr.includes(" ")) {
    const parts = schedStr.split(" ");
    if (parts[0].includes("-") || parts[0].includes("/")) {
      datePart = parts[0];
      timePart = parts[1] || "00:00";
    }
  }

  const [hStr, mStr] = timePart.split(":");
  const hour = parseInt(hStr, 10) || 0;
  const minute = parseInt(mStr, 10) || 0;

  if (datePart) {
    if (datePart.includes("/")) {
      const [d, mo, yr] = datePart.split("/").map(Number);
      if (yr && mo && d) {
        return new Date(yr, mo - 1, d, hour, minute, 0, 0);
      }
    } else if (datePart.includes("-")) {
      const [yr, mo, d] = datePart.split("-").map(Number);
      if (yr && mo && d) {
        return new Date(yr, mo - 1, d, hour, minute, 0, 0);
      }
    }
  }

  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    hour,
    minute,
    0,
    0
  );
}

/**
 * Compatibilidade: Converte schedule para Date referenciado a `referenceDate`.
 */
export function parseScheduleToToday(schedule: string, referenceDate: Date = new Date()): Date {
  return parseScheduleDate(schedule, referenceDate);
}

/**
 * Extrai apenas o horário formatado "HH:mm" de uma string de schedule.
 */
export function formatScheduleTime(schedule: string): string {
  if (!schedule) return "00:00";
  const schedStr = schedule.trim();
  const timePart = schedStr.includes("T")
    ? schedStr.split("T")[1]
    : schedStr.includes(" ")
    ? schedStr.split(" ")[1]
    : schedStr;

  const [hStr, mStr] = (timePart || "00:00").split(":");
  const h = (parseInt(hStr, 10) || 0).toString().padStart(2, "0");
  const m = (parseInt(mStr, 10) || 0).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Calcula o próximo horário somando frequencyHours ao horário anterior.
 * Trata virada de dia gerando string no formato "YYYY-MM-DD HH:mm".
 */
export function calculateNextSchedule(
  previousSchedule: string,
  frequencyHours: number,
  baseDate: Date = new Date()
): string {
  const prevDate = parseScheduleDate(previousSchedule, baseDate);
  const nextDate = new Date(prevDate.getTime() + frequencyHours * 3600 * 1000);

  const y = nextDate.getFullYear();
  const mo = String(nextDate.getMonth() + 1).padStart(2, "0");
  const d = String(nextDate.getDate()).padStart(2, "0");
  const h = String(nextDate.getHours()).padStart(2, "0");
  const mi = String(nextDate.getMinutes()).padStart(2, "0");

  return `${y}-${mo}-${d} ${h}:${mi}`;
}

/**
 * Retorna os minutos de atraso em relação ao horário programado.
 * Se o horário ainda não passou ou a medicação já foi administrada, retorna 0.
 */
export function minutesLate(
  m: Pick<TodayMedication, "schedule" | "administered">,
  now: Date = new Date()
): number {
  if (m.administered) return 0;
  const sched = parseScheduleDate(m.schedule, now);
  const diffMs = now.getTime() - sched.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  return diffMins > 0 ? diffMins : 0;
}

/**
 * Retorna os minutos restantes até o horário programado.
 * Se o horário já passou ou a medicação já foi administrada, retorna 0.
 */
export function minutesUntil(
  m: Pick<TodayMedication, "schedule" | "administered">,
  now: Date = new Date()
): number {
  if (m.administered) return 0;
  const sched = parseScheduleDate(m.schedule, now);
  const diffMs = sched.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  return diffMins > 0 ? diffMins : 0;
}

/**
 * Formata quantidade de minutos em texto legível (ex: 90 → "1h30min", 60 → "1h", 45 → "45min").
 */
export function formatMinutes(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  const hours = Math.floor(m / 60);
  const remaining = m % 60;
  if (hours === 0) return `${remaining}min`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h${remaining}min`;
}

/**
 * Retorna o status da medicação:
 * - "administrado" se m.administered === true
 * - "atrasado" se não administrado e o horário já passou há mais de 30 minutos
 * - "pendente" se não administrado e ainda não passou 30 min do horário
 */
export function getMedStatus(
  m: Pick<TodayMedication, "schedule" | "administered">,
  now: Date = new Date()
): MedStatus {
  if (m.administered) {
    return "administrado";
  }
  const sched = parseScheduleDate(m.schedule, now);
  const diffMins = (now.getTime() - sched.getTime()) / 60000;
  if (diffMins > 30) {
    return "atrasado";
  }
  return "pendente";
}
