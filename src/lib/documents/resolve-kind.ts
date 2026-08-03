import type { HabilitationKind } from "@/lib/documents/types";

/**
 * Resolve se o funil é Arrais (211) ou Motonauta (212).
 * Preferência: coluna `habilitation_kind`; fallback: nome do template.
 */
export function resolveHabilitationKind(input: {
  habilitation_kind?: string | null;
  name?: string | null;
}): HabilitationKind | null {
  const explicit = input.habilitation_kind?.trim().toLowerCase();
  if (explicit === "arrais" || explicit === "motonauta") {
    return explicit;
  }
  const name = (input.name ?? "").toLowerCase();
  if (name.includes("motonauta") || /\bmta\b/.test(name)) {
    return "motonauta";
  }
  if (name.includes("arrais") || /\bara\b/.test(name)) {
    return "arrais";
  }
  return null;
}

export function atestadoKindFor(
  habilitation: HabilitationKind,
): "atestado_arrais" | "atestado_motonauta" {
  return habilitation === "motonauta"
    ? "atestado_motonauta"
    : "atestado_arrais";
}
