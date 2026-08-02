import { isUuid } from "@/lib/processes/validate";
import {
  isProcessFieldType,
  parseFieldConfig,
} from "@/lib/processes/field-types";
import type { ProcessTemplateStageFieldInput } from "@/lib/processes/types";

export function validateFieldsReplace(
  body: unknown,
):
  | { ok: true; value: ProcessTemplateStageFieldInput[] }
  | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Body inválido." };
  }
  const fields = (body as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) {
    return { ok: false, message: "Informe a lista de campos." };
  }
  if (fields.length > 40) {
    return { ok: false, message: "Máximo de 40 campos por etapa." };
  }

  const out: ProcessTemplateStageFieldInput[] = [];
  const positions = new Set<number>();

  for (let i = 0; i < fields.length; i++) {
    const raw = fields[i];
    if (!raw || typeof raw !== "object") {
      return { ok: false, message: `Campo ${i + 1} inválido.` };
    }
    const row = raw as Record<string, unknown>;
    if (typeof row.label !== "string" || !row.label.trim()) {
      return { ok: false, message: `Rótulo do campo ${i + 1} é obrigatório.` };
    }
    if (!isProcessFieldType(row.field_type)) {
      return { ok: false, message: `Tipo do campo ${i + 1} inválido.` };
    }
    const position =
      typeof row.position === "number" ? row.position : Number(row.position);
    if (!Number.isInteger(position) || position < 0) {
      return { ok: false, message: `Posição do campo ${i + 1} inválida.` };
    }
    if (positions.has(position)) {
      return { ok: false, message: "Posições de campo duplicadas." };
    }
    positions.add(position);

    const config = parseFieldConfig(row.config);
    if (row.field_type === "select") {
      if (!config.options || config.options.length === 0) {
        return {
          ok: false,
          message: `Campo select "${row.label.trim()}" precisa de opções.`,
        };
      }
    }

    const id =
      typeof row.id === "string" && isUuid(row.id) ? row.id : undefined;

    out.push({
      id,
      label: row.label.trim().slice(0, 120),
      field_type: row.field_type,
      required: Boolean(row.required),
      position,
      config: {
        ...(config.options ? { options: config.options } : {}),
        ...(config.accept ? { accept: config.accept } : {}),
        ...(config.max_bytes ? { max_bytes: config.max_bytes } : {}),
      },
    });
  }

  out.sort((a, b) => a.position - b.position);
  return { ok: true, value: out };
}
