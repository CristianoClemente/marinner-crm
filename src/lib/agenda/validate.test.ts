import { describe, expect, it } from "vitest";
import {
  validateAgendaEventCreate,
  validateAgendaEventPatch,
} from "./validate";

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";

describe("validateAgendaEventCreate", () => {
  it("aceita lembrete sem assignees", () => {
    const parsed = validateAgendaEventCreate({
      kind: "reminder",
      title: "Ligar aluno",
      starts_at: "2026-08-01T14:00:00.000Z",
      color_key: "sky",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.ends_at).toBeNull();
      expect(parsed.value.assignee_user_ids).toEqual([]);
    }
  });

  it("aceita vários integrantes", () => {
    const parsed = validateAgendaEventCreate({
      kind: "event",
      title: "Reunião",
      starts_at: "2026-08-01T14:00:00.000Z",
      assignee_user_ids: [userA, userB, userA],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.assignee_user_ids).toEqual([userA, userB]);
    }
  });

  it("rejeita título vazio", () => {
    const parsed = validateAgendaEventCreate({
      kind: "event",
      title: "  ",
      starts_at: "2026-08-01T14:00:00.000Z",
    });
    expect(parsed.ok).toBe(false);
  });
});

describe("validateAgendaEventPatch", () => {
  it("permite limpar assignees", () => {
    const parsed = validateAgendaEventPatch({ assignee_user_ids: [] });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.assignee_user_ids).toEqual([]);
  });
});
