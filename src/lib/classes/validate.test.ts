import { describe, expect, it } from "vitest";
import { validateClassCreate, validateClassPatch } from "./validate";

const stage = "11111111-1111-4111-8111-111111111111";
const location = "22222222-2222-4222-8222-222222222222";

describe("validateClassCreate", () => {
  it("aceita turma sem instrutor", () => {
    const parsed = validateClassCreate({
      template_stage_id: stage,
      location_id: location,
      starts_at: "2026-08-01T14:00:00.000Z",
      capacity: 8,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.instructor_id).toBeNull();
      expect(parsed.value.capacity).toBe(8);
    }
  });

  it("rejeita capacity inválida", () => {
    const parsed = validateClassCreate({
      template_stage_id: stage,
      location_id: location,
      starts_at: "2026-08-01T14:00:00.000Z",
      capacity: 0,
    });
    expect(parsed.ok).toBe(false);
  });
});

describe("validateClassPatch", () => {
  it("permite limpar instrutor", () => {
    const parsed = validateClassPatch({ instructor_id: null });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.instructor_id).toBeNull();
  });
});
