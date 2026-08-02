import type { SupabaseClient } from "@supabase/supabase-js";

/** Avisos soft: não bloqueiam create/update. */
export async function collectClassConflictWarnings(input: {
  supabase: SupabaseClient;
  accountId: string;
  excludeClassId?: string;
  startsAt: string;
  instructorId: string | null;
  equipmentId: string | null;
}): Promise<string[]> {
  const warnings: string[] = [];
  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime())) return warnings;

  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(start);
  dayEnd.setHours(23, 59, 59, 999);

  let query = input.supabase
    .from("process_classes")
    .select("id, instructor_id, equipment_id, starts_at, status")
    .eq("account_id", input.accountId)
    .neq("status", "canceled")
    .gte("starts_at", dayStart.toISOString())
    .lte("starts_at", dayEnd.toISOString());

  if (input.excludeClassId) {
    query = query.neq("id", input.excludeClassId);
  }

  const { data, error } = await query;
  if (error || !data) return warnings;

  if (input.instructorId) {
    const hit = data.some((r) => r.instructor_id === input.instructorId);
    if (hit) {
      warnings.push(
        "O instrutor já tem outra turma neste dia.",
      );
    }
  }
  if (input.equipmentId) {
    const hit = data.some((r) => r.equipment_id === input.equipmentId);
    if (hit) {
      warnings.push(
        "O equipamento já está alocado em outra turma neste dia.",
      );
    }
  }
  return warnings;
}
