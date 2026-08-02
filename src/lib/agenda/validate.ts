import {
  isAgendaColorKey,
  isAgendaEventKind,
  type AgendaColorKey,
  type AgendaEventKind,
} from "@/lib/agenda/types";
import { parseAssigneeUserIds } from "@/lib/agenda/assignees";

export type AgendaEventCreateInput = {
  kind: AgendaEventKind;
  title: string;
  starts_at: string;
  ends_at: string | null;
  color_key: AgendaColorKey;
  assignee_user_ids: string[];
  notes: string | null;
};

export type AgendaEventPatchInput = {
  title?: string;
  starts_at?: string;
  ends_at?: string | null;
  color_key?: AgendaColorKey;
  assignee_user_ids?: string[];
  notes?: string | null;
  status?: "active" | "canceled";
};

function parseNotes(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 4000) : null;
}

/** Aceita assignee_user_ids[] ou legado assignee_user_id. */
function parseAssigneesFromBody(
  row: Record<string, unknown>,
): { ok: true; value: string[] } | { ok: false; message: string } {
  if ("assignee_user_ids" in row) {
    return parseAssigneeUserIds(row.assignee_user_ids);
  }
  if ("assignee_user_id" in row) {
    if (row.assignee_user_id === null || row.assignee_user_id === "") {
      return { ok: true, value: [] };
    }
    return parseAssigneeUserIds([row.assignee_user_id]);
  }
  return { ok: true, value: [] };
}

export function validateAgendaEventCreate(
  body: unknown,
):
  | { ok: true; value: AgendaEventCreateInput }
  | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Body inválido." };
  }
  const row = body as Record<string, unknown>;
  if (!isAgendaEventKind(row.kind)) {
    return { ok: false, message: "Tipo inválido." };
  }
  if (typeof row.title !== "string" || !row.title.trim()) {
    return { ok: false, message: "Título é obrigatório." };
  }
  if (typeof row.starts_at !== "string" || !row.starts_at.trim()) {
    return { ok: false, message: "Data e hora são obrigatórias." };
  }
  const starts = new Date(row.starts_at);
  if (Number.isNaN(starts.getTime())) {
    return { ok: false, message: "Data e hora inválidas." };
  }

  let ends_at: string | null = null;
  if (row.kind === "event" && row.ends_at != null && row.ends_at !== "") {
    if (typeof row.ends_at !== "string") {
      return { ok: false, message: "Término inválido." };
    }
    const ends = new Date(row.ends_at);
    if (Number.isNaN(ends.getTime())) {
      return { ok: false, message: "Término inválido." };
    }
    if (ends.getTime() < starts.getTime()) {
      return { ok: false, message: "Término deve ser após o início." };
    }
    ends_at = ends.toISOString();
  }

  const color_key = isAgendaColorKey(row.color_key) ? row.color_key : "orange";
  const assignees = parseAssigneesFromBody(row);
  if (!assignees.ok) return assignees;

  return {
    ok: true,
    value: {
      kind: row.kind,
      title: row.title.trim().slice(0, 160),
      starts_at: starts.toISOString(),
      ends_at,
      color_key,
      assignee_user_ids: assignees.value,
      notes: parseNotes(row.notes),
    },
  };
}

export function validateAgendaEventPatch(
  body: unknown,
):
  | { ok: true; value: AgendaEventPatchInput }
  | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Body inválido." };
  }
  const row = body as Record<string, unknown>;
  const out: AgendaEventPatchInput = {};

  if ("title" in row) {
    if (typeof row.title !== "string" || !row.title.trim()) {
      return { ok: false, message: "Título é obrigatório." };
    }
    out.title = row.title.trim().slice(0, 160);
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
  if ("ends_at" in row) {
    if (row.ends_at === null || row.ends_at === "") {
      out.ends_at = null;
    } else if (typeof row.ends_at === "string") {
      const ends = new Date(row.ends_at);
      if (Number.isNaN(ends.getTime())) {
        return { ok: false, message: "Término inválido." };
      }
      out.ends_at = ends.toISOString();
    } else {
      return { ok: false, message: "Término inválido." };
    }
  }
  if ("color_key" in row) {
    if (!isAgendaColorKey(row.color_key)) {
      return { ok: false, message: "Cor inválida." };
    }
    out.color_key = row.color_key;
  }
  if ("assignee_user_ids" in row || "assignee_user_id" in row) {
    const assignees = parseAssigneesFromBody(row);
    if (!assignees.ok) return assignees;
    out.assignee_user_ids = assignees.value;
  }
  if ("notes" in row) {
    out.notes = parseNotes(row.notes);
  }
  if ("status" in row) {
    if (row.status !== "active" && row.status !== "canceled") {
      return { ok: false, message: "Status inválido." };
    }
    out.status = row.status;
  }

  if (Object.keys(out).length === 0) {
    return { ok: false, message: "Nada para atualizar." };
  }
  return { ok: true, value: out };
}
