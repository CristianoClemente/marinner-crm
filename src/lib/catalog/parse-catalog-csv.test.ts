import { describe, expect, it } from "vitest";
import {
  buildCatalogCsvTemplate,
  CATALOG_CSV_HEADERS,
  parseCatalogCsv,
} from "./parse-catalog-csv";

describe("parseCatalogCsv", () => {
  it("parseia o modelo com BOM", () => {
    const csv = buildCatalogCsvTemplate();
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(CATALOG_CSV_HEADERS.join(","));

    const parsed = parseCatalogCsv(csv);
    expect(parsed.skipped).toBe(0);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      kind: "product",
      name: "Colete salva-vidas",
      unit_price: 89.9,
      sku: "COL-001",
      initial_stock: 10,
      active: true,
    });
  });

  it("aceita serviço sem estoque", () => {
    const csv = `kind,name,unit_price,sku
service,Aula prática,150,AULA-01
`;
    const parsed = parseCatalogCsv(csv);
    expect(parsed.rows[0]).toMatchObject({
      kind: "service",
      name: "Aula prática",
      unit_price: 150,
      sku: "AULA-01",
      initial_stock: 0,
    });
  });

  it("pula linhas inválidas e conta skipped", () => {
    const csv = `kind,name,unit_price
product,,10
produto,X,10
product,Ok,25.5
`;
    const parsed = parseCatalogCsv(csv);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].name).toBe("Ok");
    expect(parsed.skipped).toBe(2);
  });

  it("normaliza SKU e active em pt", () => {
    const csv = `kind,name,unit_price,sku,active
product,Boia,19.90,boia-01,sim
`;
    const parsed = parseCatalogCsv(csv);
    expect(parsed.rows[0]).toMatchObject({
      unit_price: 19.9,
      sku: "BOIA-01",
      active: true,
    });
  });

  it("exige kind, name e unit_price no header", () => {
    expect(parseCatalogCsv("name,unit_price\nX,10").rows).toHaveLength(0);
  });
});
