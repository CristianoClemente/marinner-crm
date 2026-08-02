import type { SupabaseClient } from "@supabase/supabase-js";

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

export function validateTemplateCreate(
  body: unknown,
):
  | { ok: true; value: { name: string; catalog_item_id: string; active: boolean } }
  | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Body inválido." };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.name !== "string" || !b.name.trim()) {
    return { ok: false, message: "Nome é obrigatório." };
  }
  if (!isUuid(b.catalog_item_id)) {
    return { ok: false, message: "Item do catálogo inválido." };
  }
  const active = b.active === undefined ? true : Boolean(b.active);
  return {
    ok: true,
    value: {
      name: b.name.trim().slice(0, 120),
      catalog_item_id: b.catalog_item_id,
      active,
    },
  };
}

/** Confirma que o item existe na conta e é serviço ativo. */
export async function requireActiveCatalogService(
  supabase: SupabaseClient,
  accountId: string,
  catalogItemId: string,
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const { data: item, error } = await supabase
    .from("catalog_items")
    .select("id, kind, active")
    .eq("account_id", accountId)
    .eq("id", catalogItemId)
    .maybeSingle();

  if (error || !item) {
    return {
      ok: false,
      message: "Item do catálogo não encontrado.",
      status: 400,
    };
  }
  if (item.kind !== "service") {
    return {
      ok: false,
      message: "Templates de processo só podem usar itens do tipo serviço.",
      status: 400,
    };
  }
  if (!item.active) {
    return {
      ok: false,
      message: "O serviço do catálogo precisa estar ativo.",
      status: 400,
    };
  }
  return { ok: true };
}

export function validateStagesReplace(
  body: unknown,
):
  | {
      ok: true;
      value: Array<{
        id?: string;
        name: string;
        position: number;
        allow_skip: boolean;
        accepts_classes: boolean;
      }>;
    }
  | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Body inválido." };
  }
  const stages = (body as { stages?: unknown }).stages;
  if (!Array.isArray(stages) || stages.length === 0) {
    return { ok: false, message: "Informe ao menos uma etapa." };
  }
  if (stages.length > 40) {
    return { ok: false, message: "Máximo de 40 etapas." };
  }
  const out: Array<{
    id?: string;
    name: string;
    position: number;
    allow_skip: boolean;
    accepts_classes: boolean;
  }> = [];
  const positions = new Set<number>();
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    if (!s || typeof s !== "object") {
      return { ok: false, message: `Etapa ${i + 1} inválida.` };
    }
    const row = s as Record<string, unknown>;
    if (typeof row.name !== "string" || !row.name.trim()) {
      return { ok: false, message: `Nome da etapa ${i + 1} é obrigatório.` };
    }
    const position =
      typeof row.position === "number" ? row.position : Number(row.position);
    if (!Number.isInteger(position) || position < 0) {
      return { ok: false, message: `Posição da etapa ${i + 1} inválida.` };
    }
    if (positions.has(position)) {
      return { ok: false, message: "Posições de etapa duplicadas." };
    }
    positions.add(position);
    out.push({
      id: typeof row.id === "string" && isUuid(row.id) ? row.id : undefined,
      name: row.name.trim().slice(0, 80),
      position,
      allow_skip: Boolean(row.allow_skip),
      accepts_classes: Boolean(row.accepts_classes),
    });
  }
  out.sort((a, b) => a.position - b.position);
  return { ok: true, value: out };
}
