/**
 * Alerta de validade do CHA (≤30 dias ou vencido).
 */

export type AlertLevel = "ok" | "soon" | "overdue";

export interface DateAlert {
  level: AlertLevel;
  daysUntil: number | null;
}

const SOON_DAYS = 30;

export function chaAlert(
  cha_expires_on: string | null | undefined,
  today: string,
): DateAlert {
  if (!cha_expires_on) return { level: "ok", daysUntil: null };
  const daysUntil = daysBetween(today, cha_expires_on);
  if (daysUntil < 0) return { level: "overdue", daysUntil };
  if (daysUntil <= SOON_DAYS) return { level: "soon", daysUntil };
  return { level: "ok", daysUntil };
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}
