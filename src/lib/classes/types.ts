export type ProcessClassStatus = "open" | "closed" | "canceled";

export interface ProcessClass {
  id: string;
  account_id: string;
  template_stage_id: string;
  location_id: string;
  instructor_id: string | null;
  equipment_id: string | null;
  starts_at: string;
  capacity: number;
  status: ProcessClassStatus;
  name: string | null;
  opened_at: string;
  closed_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  enrolled_count?: number;
  template_stage?: {
    id: string;
    name: string;
    template_id: string;
    accepts_classes?: boolean;
  } | null;
  location?: { id: string; name: string } | null;
  instructor?: { id: string; full_name: string } | null;
  equipment?: { id: string; name: string } | null;
  template?: {
    id: string;
    name: string;
    catalog_item?: { id: string; name: string } | null;
  } | null;
}

export interface ProcessClassEnrollment {
  id: string;
  account_id: string;
  class_id: string;
  process_id: string;
  enrolled_at: string;
  enrolled_by_user_id: string | null;
  process?: {
    id: string;
    status: string;
    current_stage_id: string | null;
    contact?: {
      id: string;
      name: string | null;
      phone: string | null;
    } | null;
  } | null;
}

export const PROCESS_CLASS_STATUSES = [
  "open",
  "closed",
  "canceled",
] as const satisfies readonly ProcessClassStatus[];

export function isProcessClassStatus(
  value: unknown,
): value is ProcessClassStatus {
  return (
    typeof value === "string" &&
    (PROCESS_CLASS_STATUSES as readonly string[]).includes(value)
  );
}
