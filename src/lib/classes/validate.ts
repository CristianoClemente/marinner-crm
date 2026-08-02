import { isUuid } from "@/lib/processes/validate";

export type ClassCreateInput = {
  template_stage_id: string;
  location_id: string;
  instructor_id: string | null;
  equipment_id: string | null;
  starts_at: string;
  capacity: number;
  name: string | null;
};

export type ClassPatchInput = {
  location_id?: string;
  instructor_id?: string | null;
  equipment_id?: string | null;
  starts_at?: string;
  capacity?: number;
  name?: string | null;
  status?: "open" | "closed" | "canceled";
};

function parseOptionalUuid(
  value: unknown,
  field: string,
): { ok: true; value: string | null } | { ok: false; message: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string" || !isUuid(value)) {
    return { ok: false, message: `${field} inválido.` };
  }
  return { ok: true, value };
}

export function validateClassCreate(
  body: unknown,
): { ok: true; value: ClassCreateInput } | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Body inválido." };
  }
  const row = body as Record<string, unknown>;
  if (typeof row.template_stage_id !== "string" || !isUuid(row.template_stage_id)) {
    return { ok: false, message: "Etapa inválida." };
  }
  if (typeof row.location_id !== "string" || !isUuid(row.location_id)) {
    return { ok: false, message: "Local inválido." };
  }
  const instructor = parseOptionalUuid(row.instructor_id, "Instrutor");
  if (!instructor.ok) return instructor;
  const equipment = parseOptionalUuid(row.equipment_id, "Equipamento");
  if (!equipment.ok) return equipment;

  if (typeof row.starts_at !== "string" || !row.starts_at.trim()) {
    return { ok: false, message: "Data e hora são obrigatórias." };
  }
  const starts = new Date(row.starts_at);
  if (Number.isNaN(starts.getTime())) {
    return { ok: false, message: "Data e hora inválidas." };
  }

  const capacity =
    typeof row.capacity === "number" ? row.capacity : Number(row.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
    return { ok: false, message: "Vagas devem ser entre 1 e 500." };
  }

  const name =
    typeof row.name === "string" && row.name.trim()
      ? row.name.trim().slice(0, 120)
      : null;

  return {
    ok: true,
    value: {
      template_stage_id: row.template_stage_id,
      location_id: row.location_id,
      instructor_id: instructor.value,
      equipment_id: equipment.value,
      starts_at: starts.toISOString(),
      capacity,
      name,
    },
  };
}

export function validateClassPatch(
  body: unknown,
): { ok: true; value: ClassPatchInput } | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Body inválido." };
  }
  const row = body as Record<string, unknown>;
  const out: ClassPatchInput = {};

  if ("location_id" in row) {
    if (typeof row.location_id !== "string" || !isUuid(row.location_id)) {
      return { ok: false, message: "Local inválido." };
    }
    out.location_id = row.location_id;
  }
  if ("instructor_id" in row) {
    const instructor = parseOptionalUuid(row.instructor_id, "Instrutor");
    if (!instructor.ok) return instructor;
    out.instructor_id = instructor.value;
  }
  if ("equipment_id" in row) {
    const equipment = parseOptionalUuid(row.equipment_id, "Equipamento");
    if (!equipment.ok) return equipment;
    out.equipment_id = equipment.value;
  }
  if ("starts_at" in row) {
    if (typeof row.starts_at !== "string" || !row.starts_at.trim()) {
      return { ok: false, message: "Data e hora inválidas." };
    }
    const starts = new Date(row.starts_at);
    if (Number.isNaN(starts.getTime())) {
      return { ok: false, message: "Data e hora inválidas." };
    }
    out.starts_at = starts.toISOString();
  }
  if ("capacity" in row) {
    const capacity =
      typeof row.capacity === "number" ? row.capacity : Number(row.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
      return { ok: false, message: "Vagas devem ser entre 1 e 500." };
    }
    out.capacity = capacity;
  }
  if ("name" in row) {
    out.name =
      typeof row.name === "string" && row.name.trim()
        ? row.name.trim().slice(0, 120)
        : null;
  }
  if ("status" in row) {
    if (row.status !== "open" && row.status !== "closed" && row.status !== "canceled") {
      return { ok: false, message: "Status inválido." };
    }
    out.status = row.status;
  }

  if (Object.keys(out).length === 0) {
    return { ok: false, message: "Nada para atualizar." };
  }
  return { ok: true, value: out };
}
