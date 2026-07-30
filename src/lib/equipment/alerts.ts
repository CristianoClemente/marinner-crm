/**
 * Alertas de documento / DPEM / próxima manutenção (≤30 dias ou vencido).
 */

export type AlertLevel = "ok" | "soon" | "overdue";

export interface DateAlert {
  level: AlertLevel;
  daysUntil: number | null;
}

const SOON_DAYS = 30;

export function alertForDate(
  on: string | null | undefined,
  today: string,
): DateAlert {
  if (!on) return { level: "ok", daysUntil: null };
  const daysUntil = daysBetween(today, on);
  if (daysUntil < 0) return { level: "overdue", daysUntil };
  if (daysUntil <= SOON_DAYS) return { level: "soon", daysUntil };
  return { level: "ok", daysUntil };
}

export interface EquipmentAlerts {
  document: DateAlert;
  dpem: DateAlert;
  nextMaintenance: DateAlert;
  hasAny: boolean;
}

export function buildEquipmentAlerts(input: {
  document_expires_on: string;
  dpem_expires_on?: string | null;
  next_maintenance_due_on?: string | null;
  today: string;
}): EquipmentAlerts {
  const document = alertForDate(input.document_expires_on, input.today);
  const dpem = alertForDate(input.dpem_expires_on, input.today);
  const nextMaintenance = alertForDate(
    input.next_maintenance_due_on,
    input.today,
  );
  const hasAny =
    document.level !== "ok" ||
    dpem.level !== "ok" ||
    nextMaintenance.level !== "ok";
  return { document, dpem, nextMaintenance, hasAny };
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}
