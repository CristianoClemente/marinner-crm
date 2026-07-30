import { describe, expect, it } from "vitest";
import { isAvailableOn, weekdayOf } from "./availability";
import {
  filterAvailableInstructors,
  parseDateParam,
} from "./resolve-available";

describe("availability edge cases", () => {
  it("weekdayOf sábado = 6", () => {
    expect(weekdayOf("2026-08-08")).toBe(6);
  });

  it("lista vazia de weekdays → nunca disponível", () => {
    expect(
      isAvailableOn("2026-08-03", {
        status: "active",
        weekdays: [],
        unavailableDates: [],
      }),
    ).toBe(false);
  });

  it("múltiplas exceções", () => {
    expect(
      isAvailableOn("2026-08-05", {
        status: "active",
        weekdays: [1, 2, 3],
        unavailableDates: ["2026-08-03", "2026-08-05"],
      }),
    ).toBe(false);
  });
});

describe("filterAvailableInstructors", () => {
  const base = {
    id: "i1",
    full_name: "Ana",
    status: "active" as const,
    cha_expires_on: "2027-01-01",
    weekdays: [1],
    unavailableDates: [] as string[],
    locationIds: ["loc-a"],
  };

  it("filtra por local + weekday", () => {
    const rows = filterAvailableInstructors({
      on: "2026-08-03", // segunda
      locationId: "loc-a",
      today: "2026-07-29",
      candidates: [
        base,
        { ...base, id: "i2", locationIds: ["loc-b"] },
        {
          ...base,
          id: "i3",
          weekdays: [2],
          locationIds: ["loc-a"],
        },
      ],
    });
    expect(rows.map((r) => r.id)).toEqual(["i1"]);
  });

  it("exclui exceção no dia", () => {
    const rows = filterAvailableInstructors({
      on: "2026-08-03",
      today: "2026-07-29",
      candidates: [
        { ...base, unavailableDates: ["2026-08-03"] },
      ],
    });
    expect(rows).toHaveLength(0);
  });

  it("inclui cha_alert overdue", () => {
    const rows = filterAvailableInstructors({
      on: "2026-08-03",
      today: "2026-07-29",
      candidates: [{ ...base, cha_expires_on: "2026-01-01" }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].cha_alert.level).toBe("overdue");
  });
});

describe("parseDateParam", () => {
  it("aceita YYYY-MM-DD", () => {
    expect(parseDateParam("2026-08-03")).toBe("2026-08-03");
  });

  it("rejeita inválido", () => {
    expect(parseDateParam("03/08/2026")).toBeNull();
    expect(parseDateParam(null)).toBeNull();
  });
});
