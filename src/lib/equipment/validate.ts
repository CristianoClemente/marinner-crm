/**
 * Validação de equipamentos e manutenções.
 */

export const EQUIPMENT_NAME_MAX = 120;
export const EQUIPMENT_TEXT_MAX = 120;
export const EQUIPMENT_DESC_MAX = 4000;

export type EquipmentKind = "vehicle" | "vessel";
export type EquipmentSubtype = "car" | "motorcycle" | "jet_ski" | "boat";
export type EngineCycle = "2t" | "4t";
export type EquipmentFuel =
  | "gasoline"
  | "ethanol"
  | "flex"
  | "diesel"
  | "electric";
export type MeterUnit = "km" | "hours";
export type EquipmentStatus =
  | "active"
  | "in_maintenance"
  | "inactive"
  | "decommissioned";
export type MaintenanceKind = "preventive" | "corrective";
export type MaintenanceStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

const KIND_SET = new Set<EquipmentKind>(["vehicle", "vessel"]);
const FUEL_SET = new Set<EquipmentFuel>([
  "gasoline",
  "ethanol",
  "flex",
  "diesel",
  "electric",
]);
const STATUS_SET = new Set<EquipmentStatus>([
  "active",
  "in_maintenance",
  "inactive",
  "decommissioned",
]);
const ENGINE_SET = new Set<EngineCycle>(["2t", "4t"]);
const MAINT_KIND_SET = new Set<MaintenanceKind>(["preventive", "corrective"]);
const MAINT_STATUS_SET = new Set<MaintenanceStatus>([
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

const SUBTYPES_BY_KIND: Record<EquipmentKind, Set<EquipmentSubtype>> = {
  vehicle: new Set(["car", "motorcycle"]),
  vessel: new Set(["jet_ski", "boat"]),
};

export function isEquipmentKind(v: unknown): v is EquipmentKind {
  return typeof v === "string" && KIND_SET.has(v as EquipmentKind);
}

export function isEquipmentStatus(v: unknown): v is EquipmentStatus {
  return typeof v === "string" && STATUS_SET.has(v as EquipmentStatus);
}

export function isEquipmentFuel(v: unknown): v is EquipmentFuel {
  return typeof v === "string" && FUEL_SET.has(v as EquipmentFuel);
}

export function isMaintenanceStatus(v: unknown): v is MaintenanceStatus {
  return typeof v === "string" && MAINT_STATUS_SET.has(v as MaintenanceStatus);
}

export function meterUnitForKind(kind: EquipmentKind): MeterUnit {
  return kind === "vehicle" ? "km" : "hours";
}

export function isSubtypeForKind(
  kind: EquipmentKind,
  subtype: unknown,
): subtype is EquipmentSubtype {
  return (
    typeof subtype === "string" &&
    SUBTYPES_BY_KIND[kind].has(subtype as EquipmentSubtype)
  );
}

function trimRequired(
  raw: unknown,
  max: number,
): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v || v.length > max) return null;
  return v;
}

function trimOptional(
  raw: unknown,
  max: number,
): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") return undefined;
  const v = raw.trim();
  if (!v) return null;
  if (v.length > max) return undefined;
  return v;
}

function parseNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw.trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseDateOnly(raw: unknown): string | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return null;
  }
  const d = raw.trim();
  if (Number.isNaN(new Date(`${d}T00:00:00.000Z`).getTime())) return null;
  return d;
}

export type EquipmentValidateError =
  | "invalid_body"
  | "empty_name"
  | "invalid_kind"
  | "invalid_subtype"
  | "invalid_fuel"
  | "invalid_status"
  | "invalid_engine"
  | "invalid_meter"
  | "invalid_date"
  | "invalid_dpem"
  | "invalid_maintenance"
  | "nothing_to_update";

export interface EquipmentCreateInput {
  name: string;
  kind: EquipmentKind;
  subtype: EquipmentSubtype;
  brand: string;
  model: string;
  engine_cycle: EngineCycle | null;
  fuel: EquipmentFuel;
  meter_value: number;
  meter_unit: MeterUnit;
  document_expires_on: string;
  plate_or_registration: string;
  dpem_expires_on: string | null;
  dpem_protocol: string | null;
  status: EquipmentStatus;
}

export interface EquipmentPatchInput {
  name?: string;
  kind?: EquipmentKind;
  subtype?: EquipmentSubtype;
  brand?: string;
  model?: string;
  engine_cycle?: EngineCycle | null;
  fuel?: EquipmentFuel;
  meter_value?: number;
  meter_unit?: MeterUnit;
  document_expires_on?: string;
  plate_or_registration?: string;
  dpem_expires_on?: string | null;
  dpem_protocol?: string | null;
  status?: EquipmentStatus;
}

function normalizeDpem(
  kind: EquipmentKind,
  dpem_expires_on: unknown,
  dpem_protocol: unknown,
):
  | { ok: true; dpem_expires_on: string | null; dpem_protocol: string | null }
  | { ok: false; error: EquipmentValidateError; message: string } {
  if (kind === "vehicle") {
    if (
      (dpem_expires_on !== undefined &&
        dpem_expires_on !== null &&
        dpem_expires_on !== "") ||
      (dpem_protocol !== undefined &&
        dpem_protocol !== null &&
        String(dpem_protocol).trim() !== "")
    ) {
      return {
        ok: false,
        error: "invalid_dpem",
        message: "Campos de DPEM só se aplicam a embarcações",
      };
    }
    return { ok: true, dpem_expires_on: null, dpem_protocol: null };
  }

  const expires = parseDateOnly(dpem_expires_on);
  const protocol =
    typeof dpem_protocol === "string" ? dpem_protocol.trim() : "";
  if (!expires || !protocol) {
    return {
      ok: false,
      error: "invalid_dpem",
      message: "DPEM (vencimento e protocolo) é obrigatório para embarcação",
    };
  }
  if (protocol.length > EQUIPMENT_TEXT_MAX) {
    return {
      ok: false,
      error: "invalid_dpem",
      message: "Protocolo DPEM muito longo",
    };
  }
  return { ok: true, dpem_expires_on: expires, dpem_protocol: protocol };
}

export function validateEquipmentCreate(
  body: unknown,
):
  | { ok: true; value: EquipmentCreateInput }
  | { ok: false; error: EquipmentValidateError; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body", message: "Body inválido" };
  }
  const b = body as Record<string, unknown>;

  const name = trimRequired(b.name, EQUIPMENT_NAME_MAX);
  if (!name) {
    return { ok: false, error: "empty_name", message: "Nome é obrigatório" };
  }
  if (!isEquipmentKind(b.kind)) {
    return { ok: false, error: "invalid_kind", message: "Tipo inválido" };
  }
  if (!isSubtypeForKind(b.kind, b.subtype)) {
    return {
      ok: false,
      error: "invalid_subtype",
      message: "Subtipo inválido para o tipo",
    };
  }
  const brand = trimRequired(b.brand, EQUIPMENT_TEXT_MAX);
  const model = trimRequired(b.model, EQUIPMENT_TEXT_MAX);
  if (!brand || !model) {
    return {
      ok: false,
      error: "invalid_body",
      message: "Marca e modelo são obrigatórios",
    };
  }
  if (!isEquipmentFuel(b.fuel)) {
    return {
      ok: false,
      error: "invalid_fuel",
      message: "Combustível inválido",
    };
  }

  let engine_cycle: EngineCycle | null = null;
  if (b.engine_cycle !== undefined && b.engine_cycle !== null && b.engine_cycle !== "") {
    if (!ENGINE_SET.has(b.engine_cycle as EngineCycle)) {
      return {
        ok: false,
        error: "invalid_engine",
        message: "Ciclo do motor inválido",
      };
    }
    engine_cycle = b.engine_cycle as EngineCycle;
  }
  if (b.subtype === "car") engine_cycle = null;

  const meterRaw = b.meter_value === undefined ? 0 : parseNumber(b.meter_value);
  if (meterRaw === null || meterRaw < 0) {
    return {
      ok: false,
      error: "invalid_meter",
      message: "Medidor inválido",
    };
  }

  const document_expires_on = parseDateOnly(b.document_expires_on);
  if (!document_expires_on) {
    return {
      ok: false,
      error: "invalid_date",
      message: "Vencimento do documento inválido",
    };
  }

  const plate = trimRequired(b.plate_or_registration, EQUIPMENT_TEXT_MAX);
  if (!plate) {
    return {
      ok: false,
      error: "invalid_body",
      message: "Placa / inscrição é obrigatória",
    };
  }

  const dpem = normalizeDpem(b.kind, b.dpem_expires_on, b.dpem_protocol);
  if (!dpem.ok) return dpem;

  const status =
    b.status === undefined || b.status === null
      ? "active"
      : isEquipmentStatus(b.status)
        ? b.status
        : null;
  if (!status) {
    return {
      ok: false,
      error: "invalid_status",
      message: "Status inválido",
    };
  }

  return {
    ok: true,
    value: {
      name,
      kind: b.kind,
      subtype: b.subtype,
      brand,
      model,
      engine_cycle,
      fuel: b.fuel,
      meter_value: Math.round(meterRaw * 10) / 10,
      meter_unit: meterUnitForKind(b.kind),
      document_expires_on,
      plate_or_registration: plate,
      dpem_expires_on: dpem.dpem_expires_on,
      dpem_protocol: dpem.dpem_protocol,
      status,
    },
  };
}

export function validateEquipmentPatch(
  body: unknown,
  current: {
    kind: EquipmentKind;
    subtype: EquipmentSubtype;
    status: EquipmentStatus;
  },
):
  | { ok: true; value: EquipmentPatchInput }
  | { ok: false; error: EquipmentValidateError; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body", message: "Body inválido" };
  }
  const b = body as Record<string, unknown>;
  const patch: EquipmentPatchInput = {};

  const kind = isEquipmentKind(b.kind) ? b.kind : current.kind;
  if ("kind" in b) {
    if (!isEquipmentKind(b.kind)) {
      return { ok: false, error: "invalid_kind", message: "Tipo inválido" };
    }
    patch.kind = b.kind;
    patch.meter_unit = meterUnitForKind(b.kind);
  }

  if ("subtype" in b || "kind" in b) {
    const subtype = "subtype" in b ? b.subtype : current.subtype;
    if (!isSubtypeForKind(kind, subtype)) {
      return {
        ok: false,
        error: "invalid_subtype",
        message: "Subtipo inválido para o tipo",
      };
    }
    if ("subtype" in b) patch.subtype = subtype;
  }

  if ("name" in b) {
    const name = trimRequired(b.name, EQUIPMENT_NAME_MAX);
    if (!name) {
      return { ok: false, error: "empty_name", message: "Nome é obrigatório" };
    }
    patch.name = name;
  }
  if ("brand" in b) {
    const brand = trimRequired(b.brand, EQUIPMENT_TEXT_MAX);
    if (!brand) {
      return { ok: false, error: "invalid_body", message: "Marca inválida" };
    }
    patch.brand = brand;
  }
  if ("model" in b) {
    const model = trimRequired(b.model, EQUIPMENT_TEXT_MAX);
    if (!model) {
      return { ok: false, error: "invalid_body", message: "Modelo inválido" };
    }
    patch.model = model;
  }
  if ("fuel" in b) {
    if (!isEquipmentFuel(b.fuel)) {
      return {
        ok: false,
        error: "invalid_fuel",
        message: "Combustível inválido",
      };
    }
    patch.fuel = b.fuel;
  }
  if ("engine_cycle" in b) {
    if (b.engine_cycle === null || b.engine_cycle === "") {
      patch.engine_cycle = null;
    } else if (ENGINE_SET.has(b.engine_cycle as EngineCycle)) {
      patch.engine_cycle = b.engine_cycle as EngineCycle;
    } else {
      return {
        ok: false,
        error: "invalid_engine",
        message: "Ciclo do motor inválido",
      };
    }
  }
  const nextSubtype =
    patch.subtype ??
    (isSubtypeForKind(kind, current.subtype) ? current.subtype : null);
  if (nextSubtype === "car") patch.engine_cycle = null;

  if ("meter_value" in b) {
    const meter = parseNumber(b.meter_value);
    if (meter === null || meter < 0) {
      return {
        ok: false,
        error: "invalid_meter",
        message: "Medidor inválido",
      };
    }
    patch.meter_value = Math.round(meter * 10) / 10;
  }
  if ("document_expires_on" in b) {
    const d = parseDateOnly(b.document_expires_on);
    if (!d) {
      return {
        ok: false,
        error: "invalid_date",
        message: "Vencimento do documento inválido",
      };
    }
    patch.document_expires_on = d;
  }
  if ("plate_or_registration" in b) {
    const plate = trimRequired(b.plate_or_registration, EQUIPMENT_TEXT_MAX);
    if (!plate) {
      return {
        ok: false,
        error: "invalid_body",
        message: "Placa / inscrição inválida",
      };
    }
    patch.plate_or_registration = plate;
  }
  if ("status" in b) {
    if (!isEquipmentStatus(b.status)) {
      return {
        ok: false,
        error: "invalid_status",
        message: "Status inválido",
      };
    }
    patch.status = b.status;
  }

  const touchesDpem =
    "kind" in b || "dpem_expires_on" in b || "dpem_protocol" in b;
  if (touchesDpem) {
    if (kind === "vehicle") {
      patch.dpem_expires_on = null;
      patch.dpem_protocol = null;
    } else {
      const dpem = normalizeDpem(kind, b.dpem_expires_on, b.dpem_protocol);
      if (!dpem.ok) return dpem;
      patch.dpem_expires_on = dpem.dpem_expires_on;
      patch.dpem_protocol = dpem.dpem_protocol;
    }
  }

  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      error: "nothing_to_update",
      message: "Nada para atualizar",
    };
  }
  return { ok: true, value: patch };
}

export interface MaintenanceCreateInput {
  kind: MaintenanceKind;
  performed_on: string;
  description: string;
  meter_value_at: number | null;
  cost: number | null;
  vendor: string | null;
  next_due_on: string | null;
  status: MaintenanceStatus;
}

export interface MaintenancePatchInput {
  kind?: MaintenanceKind;
  performed_on?: string;
  description?: string;
  meter_value_at?: number | null;
  cost?: number | null;
  vendor?: string | null;
  next_due_on?: string | null;
  status?: MaintenanceStatus;
}

export function validateMaintenanceCreate(
  body: unknown,
):
  | { ok: true; value: MaintenanceCreateInput }
  | { ok: false; error: EquipmentValidateError; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body", message: "Body inválido" };
  }
  const b = body as Record<string, unknown>;

  if (!MAINT_KIND_SET.has(b.kind as MaintenanceKind)) {
    return {
      ok: false,
      error: "invalid_maintenance",
      message: "Tipo de manutenção inválido",
    };
  }
  const performed_on = parseDateOnly(b.performed_on);
  if (!performed_on) {
    return {
      ok: false,
      error: "invalid_date",
      message: "Data da manutenção inválida",
    };
  }
  const description = trimRequired(b.description, EQUIPMENT_DESC_MAX);
  if (!description) {
    return {
      ok: false,
      error: "invalid_maintenance",
      message: "Descrição é obrigatória",
    };
  }

  let meter_value_at: number | null = null;
  if (b.meter_value_at !== undefined && b.meter_value_at !== null && b.meter_value_at !== "") {
    const m = parseNumber(b.meter_value_at);
    if (m === null || m < 0) {
      return {
        ok: false,
        error: "invalid_meter",
        message: "Medidor no momento inválido",
      };
    }
    meter_value_at = Math.round(m * 10) / 10;
  }

  let cost: number | null = null;
  if (b.cost !== undefined && b.cost !== null && b.cost !== "") {
    const c = parseNumber(b.cost);
    if (c === null || c < 0) {
      return {
        ok: false,
        error: "invalid_maintenance",
        message: "Custo inválido",
      };
    }
    cost = Math.round(c * 100) / 100;
  }

  const vendor = trimOptional(b.vendor, EQUIPMENT_TEXT_MAX);
  if (vendor === undefined) {
    return {
      ok: false,
      error: "invalid_maintenance",
      message: "Fornecedor inválido",
    };
  }

  let next_due_on: string | null = null;
  if (b.next_due_on !== undefined && b.next_due_on !== null && b.next_due_on !== "") {
    next_due_on = parseDateOnly(b.next_due_on);
    if (!next_due_on) {
      return {
        ok: false,
        error: "invalid_date",
        message: "Próxima manutenção inválida",
      };
    }
  }

  const status =
    b.status === undefined
      ? "completed"
      : isMaintenanceStatus(b.status)
        ? b.status
        : null;
  if (!status) {
    return {
      ok: false,
      error: "invalid_maintenance",
      message: "Status da manutenção inválido",
    };
  }

  return {
    ok: true,
    value: {
      kind: b.kind as MaintenanceKind,
      performed_on,
      description,
      meter_value_at,
      cost,
      vendor,
      next_due_on,
      status,
    },
  };
}

export function validateMaintenancePatch(
  body: unknown,
):
  | { ok: true; value: MaintenancePatchInput }
  | { ok: false; error: EquipmentValidateError; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body", message: "Body inválido" };
  }
  const b = body as Record<string, unknown>;
  const patch: MaintenancePatchInput = {};

  if ("kind" in b) {
    if (!MAINT_KIND_SET.has(b.kind as MaintenanceKind)) {
      return {
        ok: false,
        error: "invalid_maintenance",
        message: "Tipo de manutenção inválido",
      };
    }
    patch.kind = b.kind as MaintenanceKind;
  }
  if ("performed_on" in b) {
    const d = parseDateOnly(b.performed_on);
    if (!d) {
      return {
        ok: false,
        error: "invalid_date",
        message: "Data da manutenção inválida",
      };
    }
    patch.performed_on = d;
  }
  if ("description" in b) {
    const description = trimRequired(b.description, EQUIPMENT_DESC_MAX);
    if (!description) {
      return {
        ok: false,
        error: "invalid_maintenance",
        message: "Descrição é obrigatória",
      };
    }
    patch.description = description;
  }
  if ("meter_value_at" in b) {
    if (b.meter_value_at === null || b.meter_value_at === "") {
      patch.meter_value_at = null;
    } else {
      const m = parseNumber(b.meter_value_at);
      if (m === null || m < 0) {
        return {
          ok: false,
          error: "invalid_meter",
          message: "Medidor no momento inválido",
        };
      }
      patch.meter_value_at = Math.round(m * 10) / 10;
    }
  }
  if ("cost" in b) {
    if (b.cost === null || b.cost === "") {
      patch.cost = null;
    } else {
      const c = parseNumber(b.cost);
      if (c === null || c < 0) {
        return {
          ok: false,
          error: "invalid_maintenance",
          message: "Custo inválido",
        };
      }
      patch.cost = Math.round(c * 100) / 100;
    }
  }
  if ("vendor" in b) {
    const vendor = trimOptional(b.vendor, EQUIPMENT_TEXT_MAX);
    if (vendor === undefined) {
      return {
        ok: false,
        error: "invalid_maintenance",
        message: "Fornecedor inválido",
      };
    }
    patch.vendor = vendor;
  }
  if ("next_due_on" in b) {
    if (b.next_due_on === null || b.next_due_on === "") {
      patch.next_due_on = null;
    } else {
      const d = parseDateOnly(b.next_due_on);
      if (!d) {
        return {
          ok: false,
          error: "invalid_date",
          message: "Próxima manutenção inválida",
        };
      }
      patch.next_due_on = d;
    }
  }
  if ("status" in b) {
    if (!isMaintenanceStatus(b.status)) {
      return {
        ok: false,
        error: "invalid_maintenance",
        message: "Status da manutenção inválido",
      };
    }
    patch.status = b.status;
  }

  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      error: "nothing_to_update",
      message: "Nada para atualizar",
    };
  }
  return { ok: true, value: patch };
}
