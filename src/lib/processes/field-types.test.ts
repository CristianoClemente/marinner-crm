import { describe, expect, it } from "vitest";

import {
  isFieldComplete,
  normalizeScalarValue,
} from "@/lib/processes/field-types";
import {
  fieldSummary,
  requiredMissingLabels,
} from "@/lib/processes/field-values";
import { validateFieldsReplace } from "@/lib/processes/validate-fields";
import type { ProcessTemplateStageField } from "@/lib/processes/types";

function field(
  partial: Partial<ProcessTemplateStageField> &
    Pick<ProcessTemplateStageField, "label" | "field_type" | "required">,
): ProcessTemplateStageField {
  return {
    id: partial.id ?? "11111111-1111-4111-8111-111111111111",
    account_id: "a",
    stage_id: "s",
    position: partial.position ?? 0,
    config: partial.config ?? {},
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("isFieldComplete", () => {
  it("file exige storage_path", () => {
    expect(isFieldComplete("file", null)).toBe(false);
    expect(isFieldComplete("file", { value: null, storage_path: "x" })).toBe(
      true,
    );
  });

  it("checkbox required só com true", () => {
    expect(isFieldComplete("checkbox", { value: false, storage_path: null })).toBe(
      false,
    );
    expect(isFieldComplete("checkbox", { value: true, storage_path: null })).toBe(
      true,
    );
  });

  it("text ignora whitespace", () => {
    expect(
      isFieldComplete("text", { value: "  ", storage_path: null }),
    ).toBe(false);
    expect(
      isFieldComplete("text", { value: "ok", storage_path: null }),
    ).toBe(true);
  });
});

describe("requiredMissingLabels / fieldSummary", () => {
  it("conta só required incompletos", () => {
    const items = [
      {
        field: field({ label: "RG", field_type: "file", required: true }),
        value: null,
      },
      {
        field: field({
          id: "22222222-2222-4222-8222-222222222222",
          label: "Obs",
          field_type: "text",
          required: false,
        }),
        value: null,
      },
    ];
    expect(requiredMissingLabels(items)).toEqual(["RG"]);
    expect(fieldSummary(items)).toEqual({
      fields_total: 2,
      fields_filled: 0,
      fields_required_missing: 1,
    });
  });
});

describe("normalizeScalarValue", () => {
  it("normaliza checkbox e text", () => {
    expect(normalizeScalarValue("checkbox", "true")).toBe(true);
    expect(normalizeScalarValue("text", "  hi ")).toBe("hi");
    expect(normalizeScalarValue("file", "x")).toBe(null);
  });
});

describe("validateFieldsReplace", () => {
  it("aceita lista válida e rejeita select sem opções", () => {
    const ok = validateFieldsReplace({
      fields: [
        {
          label: "Nome",
          field_type: "text",
          required: true,
          position: 0,
        },
      ],
    });
    expect(ok.ok).toBe(true);

    const bad = validateFieldsReplace({
      fields: [
        {
          label: "Tipo",
          field_type: "select",
          required: false,
          position: 0,
          config: { options: [] },
        },
      ],
    });
    expect(bad.ok).toBe(false);
  });
});
