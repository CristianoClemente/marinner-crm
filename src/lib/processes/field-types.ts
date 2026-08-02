import type { ProcessFieldType, ProcessFieldValueRow } from "@/lib/processes/types";

export const PROCESS_FIELD_TYPES = [
  "file",
  "checkbox",
  "text",
  "textarea",
  "date",
  "select",
] as const satisfies readonly ProcessFieldType[];

export function isProcessFieldType(value: unknown): value is ProcessFieldType {
  return (
    typeof value === "string" &&
    (PROCESS_FIELD_TYPES as readonly string[]).includes(value)
  );
}

export type FieldConfig = {
  options?: string[];
  accept?: string;
  max_bytes?: number;
};

export function parseFieldConfig(raw: unknown): FieldConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const config: FieldConfig = {};
  if (Array.isArray(o.options)) {
    config.options = o.options
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 40);
  }
  if (typeof o.accept === "string" && o.accept.trim()) {
    config.accept = o.accept.trim().slice(0, 200);
  }
  if (typeof o.max_bytes === "number" && Number.isFinite(o.max_bytes) && o.max_bytes > 0) {
    config.max_bytes = Math.floor(o.max_bytes);
  }
  return config;
}

/** Valor escalar “preenchido” para tipos não-file. */
export function isScalarFilled(
  fieldType: ProcessFieldType,
  value: unknown,
): boolean {
  if (fieldType === "file") return false;
  if (fieldType === "checkbox") return value === true;
  if (typeof value !== "string") return false;
  return value.trim().length > 0;
}

export function isFieldComplete(
  fieldType: ProcessFieldType,
  row: Pick<ProcessFieldValueRow, "value" | "storage_path"> | null | undefined,
): boolean {
  if (fieldType === "file") {
    return Boolean(row?.storage_path?.trim());
  }
  return isScalarFilled(fieldType, row?.value ?? null);
}

export function normalizeScalarValue(
  fieldType: ProcessFieldType,
  raw: unknown,
): unknown | null {
  if (fieldType === "file") return null;
  if (fieldType === "checkbox") {
    if (raw === true || raw === false) return raw;
    if (raw === "true") return true;
    if (raw === "false") return false;
    return null;
  }
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, fieldType === "textarea" ? 4000 : 500);
}
