import { describe, expect, it } from "vitest";

import {
  getQuickStartTemplate,
  QUICK_START_ORDER,
  QUICK_START_TEMPLATES,
  type QuickStartSlug,
} from "./quick-start-templates";

describe("quick-start-templates", () => {
  it("expõe os três slugs na ordem venda → arrais → motonauta", () => {
    expect(QUICK_START_ORDER).toEqual([
      "sales_pipeline",
      "arrais_amador",
      "motonauta",
    ]);
    for (const slug of QUICK_START_ORDER) {
      expect(QUICK_START_TEMPLATES[slug].slug).toBe(slug);
    }
  });

  it("marca venda como sale/free sem exigir catálogo", () => {
    const sale = getQuickStartTemplate("sales_pipeline");
    expect(sale.kind).toBe("sale");
    expect(sale.capabilities.advance_mode).toBe("free");
    expect(sale.capabilities.requires_catalog_item).toBe(false);
    expect(sale.capabilities.has_monetary_value).toBe(true);
    expect(sale.capabilities.has_commercial_outcome).toBe(true);
    expect(sale.stages).toHaveLength(4);
  });

  it("marca arrais e motonauta como process/sequential com catálogo e campos", () => {
    for (const slug of ["arrais_amador", "motonauta"] as QuickStartSlug[]) {
      const tpl = getQuickStartTemplate(slug);
      expect(tpl.kind).toBe("process");
      expect(tpl.capabilities.advance_mode).toBe("sequential");
      expect(tpl.capabilities.requires_catalog_item).toBe(true);
      expect(tpl.capabilities.block_advance_if_incomplete).toBe(true);
      expect(tpl.stages).toHaveLength(5);
      const practice = tpl.stages.find((s) => s.accepts_classes);
      expect(practice).toBeDefined();
      const docs = tpl.stages[0];
      expect(docs.fields.length).toBeGreaterThanOrEqual(4);
      expect(docs.fields.every((f) => f.field_type === "file" && f.required)).toBe(
        true,
      );
      const prova = tpl.stages.find((s) =>
        s.fields.some((f) => f.field_type === "select"),
      );
      expect(prova).toBeDefined();
    }
  });

  it("getQuickStartTemplate lança para slug desconhecido", () => {
    expect(() =>
      getQuickStartTemplate("despachante" as QuickStartSlug),
    ).toThrow();
  });
});
