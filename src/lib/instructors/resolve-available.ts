/**
 * Helpers de disponibilidade para o endpoint /available.
 */

import { chaAlert, type DateAlert } from "./alerts";
import { isAvailableOn } from "./availability";
import type { InstructorStatus } from "./validate";

export interface AvailableCandidate {
  id: string;
  full_name: string;
  status: InstructorStatus;
  cha_expires_on: string;
  /** Weekdays ativos (já filtrados active=true). */
  weekdays: number[];
  unavailableDates: string[];
  /** Locais ativos vinculados (ids). */
  locationIds: string[];
}

export interface AvailableInstructorRow {
  id: string;
  full_name: string;
  cha_expires_on: string;
  cha_alert: DateAlert;
}

export function filterAvailableInstructors(input: {
  on: string;
  locationId?: string | null;
  today: string;
  candidates: AvailableCandidate[];
}): AvailableInstructorRow[] {
  const rows: AvailableInstructorRow[] = [];
  for (const c of input.candidates) {
    if (input.locationId && !c.locationIds.includes(input.locationId)) {
      continue;
    }
    if (
      !isAvailableOn(input.on, {
        status: c.status,
        weekdays: c.weekdays,
        unavailableDates: c.unavailableDates,
      })
    ) {
      continue;
    }
    rows.push({
      id: c.id,
      full_name: c.full_name,
      cha_expires_on: c.cha_expires_on,
      cha_alert: chaAlert(c.cha_expires_on, input.today),
    });
  }
  return rows;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateParam(raw: string | null): string | null {
  if (!raw || !DATE_RE.test(raw)) return null;
  if (Number.isNaN(Date.parse(`${raw}T00:00:00.000Z`))) return null;
  return raw;
}
