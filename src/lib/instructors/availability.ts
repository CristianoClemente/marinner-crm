/**
 * Disponibilidade = status active ∩ weekday no padrão ∩ data fora das exceções.
 */

import type { InstructorStatus } from "./validate";

export interface AvailabilityInput {
  status: InstructorStatus;
  /** Dias da semana ativos (0=domingo … 6=sábado). */
  weekdays: readonly number[];
  /** Datas YYYY-MM-DD marcadas como indisponíveis. */
  unavailableDates: readonly string[];
}

/** Weekday de uma data YYYY-MM-DD em UTC (domingo=0). */
export function weekdayOf(dateOnly: string): number {
  const ms = Date.parse(`${dateOnly}T00:00:00.000Z`);
  return new Date(ms).getUTCDay();
}

export function isAvailableOn(
  dateOnly: string,
  input: AvailabilityInput,
): boolean {
  if (input.status !== "active") return false;
  const weekday = weekdayOf(dateOnly);
  if (!input.weekdays.includes(weekday)) return false;
  if (input.unavailableDates.includes(dateOnly)) return false;
  return true;
}
