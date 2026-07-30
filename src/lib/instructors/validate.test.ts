import { describe, expect, it } from "vitest";
import { chaAlert } from "./alerts";
import { isAvailableOn, weekdayOf } from "./availability";
import {
  validateInstructorCreate,
  validateInstructorPatch,
  validateUnavailabilityCreate,
  validateWeeklyReplace,
} from "./validate";

const validCreate = {
  full_name: "Ana Silva",
  phone: "11999998888",
  birth_date: "1990-05-10",
  cha_number: "CHA-123",
  cha_category: "mta",
  cha_expires_on: "2027-01-01",
  pix_key: "ana@escola.com",
};

describe("validateInstructorCreate", () => {
  it("aceita payload válido", () => {
    const r = validateInstructorCreate(validCreate);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.status).toBe("active");
      expect(r.value.cha_category).toBe("mta");
      expect(r.value.pix_key).toBe("ana@escola.com");
    }
  });

  it("permite CHA já vencida (não bloqueia save)", () => {
    const r = validateInstructorCreate({
      ...validCreate,
      cha_expires_on: "2020-01-01",
    });
    expect(r.ok).toBe(true);
  });

  it("rejeita categoria CHA inválida", () => {
    const r = validateInstructorCreate({
      ...validCreate,
      cha_category: "xyz",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_cha_category");
  });

  it("rejeita PIX vazio", () => {
    const r = validateInstructorCreate({ ...validCreate, pix_key: "  " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_pix");
  });

  it("rejeita telefone vazio", () => {
    const r = validateInstructorCreate({ ...validCreate, phone: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_phone");
  });

  it("rejeita birth_date inválida", () => {
    const r = validateInstructorCreate({
      ...validCreate,
      birth_date: "10/05/1990",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_date");
  });
});

describe("validateInstructorPatch", () => {
  it("aceita patch parcial", () => {
    const r = validateInstructorPatch({ full_name: "Ana S." });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.full_name).toBe("Ana S.");
  });

  it("rejeita body vazio", () => {
    const r = validateInstructorPatch({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("nothing_to_update");
  });

  it("aceita status inactive", () => {
    const r = validateInstructorPatch({ status: "inactive" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.status).toBe("inactive");
  });
});

describe("validateWeeklyReplace", () => {
  it("aceita weekdays 0–6 únicos", () => {
    const r = validateWeeklyReplace({ weekdays: [1, 3, 5] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.weekdays).toEqual([1, 3, 5]);
  });

  it("rejeita weekday fora do range", () => {
    const r = validateWeeklyReplace({ weekdays: [7] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_weekday");
  });

  it("deduplica weekdays", () => {
    const r = validateWeeklyReplace({ weekdays: [1, 1, 2] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.weekdays).toEqual([1, 2]);
  });
});

describe("validateUnavailabilityCreate", () => {
  it("aceita data com reason opcional", () => {
    const r = validateUnavailabilityCreate({
      on_date: "2026-08-15",
      reason: "Férias",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.on_date).toBe("2026-08-15");
      expect(r.value.reason).toBe("Férias");
    }
  });

  it("aceita sem reason", () => {
    const r = validateUnavailabilityCreate({ on_date: "2026-08-15" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.reason).toBeNull();
  });
});

describe("availability", () => {
  it("weekdayOf usa domingo=0 (UTC date-only)", () => {
    // 2026-08-02 é domingo
    expect(weekdayOf("2026-08-02")).toBe(0);
    // 2026-08-03 é segunda
    expect(weekdayOf("2026-08-03")).toBe(1);
  });

  it("disponível quando active + weekday + sem exceção", () => {
    expect(
      isAvailableOn("2026-08-03", {
        status: "active",
        weekdays: [1, 3, 5],
        unavailableDates: ["2026-08-10"],
      }),
    ).toBe(true);
  });

  it("indisponível se inactive", () => {
    expect(
      isAvailableOn("2026-08-03", {
        status: "inactive",
        weekdays: [1],
        unavailableDates: [],
      }),
    ).toBe(false);
  });

  it("indisponível se weekday fora do padrão", () => {
    expect(
      isAvailableOn("2026-08-04", {
        status: "active",
        weekdays: [1, 3, 5],
        unavailableDates: [],
      }),
    ).toBe(false);
  });

  it("indisponível se data em unavailability", () => {
    expect(
      isAvailableOn("2026-08-03", {
        status: "active",
        weekdays: [1],
        unavailableDates: ["2026-08-03"],
      }),
    ).toBe(false);
  });
});

describe("chaAlert", () => {
  it("ok quando falta mais de 30 dias", () => {
    expect(chaAlert("2026-12-01", "2026-07-29").level).toBe("ok");
  });

  it("soon quando ≤30 dias", () => {
    expect(chaAlert("2026-08-10", "2026-07-29").level).toBe("soon");
  });

  it("overdue quando vencida", () => {
    expect(chaAlert("2026-07-01", "2026-07-29").level).toBe("overdue");
  });
});
