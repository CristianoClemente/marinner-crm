import { describe, expect, it } from "vitest";
import {
  validateBonusRuleCreate,
  validateClassLocationCreate,
} from "./validate";
import { resolveBonusRule } from "./resolve-bonus";

describe("validateClassLocationCreate", () => {
  it("aceita local sem despesa", () => {
    const r = validateClassLocationCreate({
      name: "Marina Centro",
      cidade: "Santos",
      has_expense: false,
      authority_id: 66,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.expense_type).toBeNull();
      expect(r.value.expense_amount).toBeNull();
      expect(r.value.authority_id).toBe(66);
    }
  });

  it("rejeita sem jurisdição", () => {
    const r = validateClassLocationCreate({
      name: "X",
      has_expense: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("missing_authority");
  });

  it("rejeita tipo/valor quando sem despesa", () => {
    const r = validateClassLocationCreate({
      name: "X",
      has_expense: false,
      expense_type: "monthly_fee",
      expense_amount: 100,
      authority_id: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_expense");
  });

  it("exige tipo e valor com despesa", () => {
    expect(
      validateClassLocationCreate({
        name: "X",
        has_expense: true,
        authority_id: 1,
      }).ok,
    ).toBe(false);

    const r = validateClassLocationCreate({
      name: "X",
      has_expense: true,
      expense_type: "per_class",
      expense_amount: 50,
      authority_id: 1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.expense_type).toBe("per_class");
      expect(r.value.expense_amount).toBe(50);
    }
  });
});

describe("validateBonusRuleCreate", () => {
  it("rejeita fim antes do início", () => {
    const r = validateBonusRuleCreate({
      bonus_type: "per_student",
      bonus_amount: 10,
      starts_on: "2026-06-01",
      ends_on: "2026-05-01",
    });
    expect(r.ok).toBe(false);
  });
});

describe("resolveBonusRule", () => {
  const base = {
    bonus_type: "per_student" as const,
    bonus_amount: 20,
    created_at: "2026-01-01T00:00:00.000Z",
  };

  it("ignora inativa, futura e expirada", () => {
    const r = resolveBonusRule(
      [
        {
          id: "1",
          ...base,
          starts_on: "2026-01-01",
          ends_on: "2026-01-31",
          active: true,
        },
        {
          id: "2",
          ...base,
          bonus_amount: 30,
          starts_on: "2026-03-01",
          ends_on: null,
          active: true,
        },
        {
          id: "3",
          ...base,
          bonus_amount: 99,
          starts_on: "2026-01-01",
          ends_on: null,
          active: false,
        },
      ],
      "2026-02-15",
    );
    expect(r).toBeNull();
  });

  it("escolhe a starts_on mais recente vigente", () => {
    const r = resolveBonusRule(
      [
        {
          id: "old",
          ...base,
          bonus_amount: 10,
          starts_on: "2026-01-01",
          ends_on: null,
          active: true,
        },
        {
          id: "new",
          ...base,
          bonus_amount: 25,
          starts_on: "2026-03-01",
          ends_on: null,
          active: true,
          created_at: "2026-03-01T00:00:00.000Z",
        },
      ],
      "2026-03-15",
    );
    expect(r?.id).toBe("new");
    expect(r?.bonus_amount).toBe(25);
  });
});
