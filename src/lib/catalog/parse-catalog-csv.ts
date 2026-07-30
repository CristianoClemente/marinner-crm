/**
 * CSV parsing for the catalog import modal.
 * Headers align with catalog_items writable fields (+ initial_stock on create).
 */

import {
  isCatalogItemKind,
  normalizeSku,
  validateCatalogCreate,
} from "@/lib/catalog/validate";
import type { CatalogItemKind } from "@/types";

export interface ParsedCatalogRow {
  kind: CatalogItemKind;
  name: string;
  unit_price: number;
  sku: string | null;
  description: string | null;
  initial_stock: number;
  active: boolean;
  /** 1-based CSV line (header = 1) for error messages. */
  line: number;
}

export const CATALOG_CSV_HEADERS = [
  "kind",
  "name",
  "unit_price",
  "sku",
  "description",
  "initial_stock",
  "active",
] as const;

export type CatalogCsvHeader = (typeof CATALOG_CSV_HEADERS)[number];

const TEMPLATE_EXAMPLE: Record<CatalogCsvHeader, string> = {
  kind: "product",
  name: "Colete salva-vidas",
  unit_price: "89.90",
  sku: "COL-001",
  description: "Colete adulto classe III",
  initial_stock: "10",
  active: "true",
};

export function buildCatalogCsvTemplate(): string {
  const header = CATALOG_CSV_HEADERS.join(",");
  const example = CATALOG_CSV_HEADERS.map((key) => TEMPLATE_EXAMPLE[key]).join(
    ",",
  );
  return `\uFEFF${header}\n${example}\n`;
}

export function downloadCatalogCsvTemplate(
  filename = "modelo-catalogo.csv",
): void {
  const blob = new Blob([buildCatalogCsvTemplate()], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseBooleanCell(value: string | undefined, fallback: boolean): boolean {
  if (!value?.trim()) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "sim", "yes", "s", "y"].includes(normalized)) return true;
  if (["false", "0", "nao", "não", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function cellAt(values: string[], idx: number): string | undefined {
  if (idx < 0) return undefined;
  const raw = values[idx]?.replace(/^["']|["']$/g, "").trim();
  return raw || undefined;
}

function parseNumberCell(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export interface ParseCatalogCsvResult {
  rows: ParsedCatalogRow[];
  skipped: number;
}

export function parseCatalogCsv(text: string): ParseCatalogCsvResult {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { rows: [], skipped: 0 };
  }

  const headers = parseCsvLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/["']/g, ""),
  );

  const kindIdx = headers.indexOf("kind");
  const nameIdx = headers.indexOf("name");
  const priceIdx = headers.indexOf("unit_price");
  if (kindIdx === -1 || nameIdx === -1 || priceIdx === -1) {
    return { rows: [], skipped: 0 };
  }

  const skuIdx = headers.indexOf("sku");
  const descIdx = headers.indexOf("description");
  const stockIdx = headers.indexOf("initial_stock");
  const activeIdx = headers.indexOf("active");

  const rows: ParsedCatalogRow[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const kindRaw = cellAt(values, kindIdx)?.toLowerCase();
    const name = cellAt(values, nameIdx);
    const price = parseNumberCell(cellAt(values, priceIdx));

    if (!kindRaw || !isCatalogItemKind(kindRaw) || !name || price === null) {
      skipped += 1;
      continue;
    }

    const sku = normalizeSku(cellAt(values, skuIdx) ?? null);
    const description = cellAt(values, descIdx) ?? null;
    const stockRaw = parseNumberCell(cellAt(values, stockIdx));
    const initial_stock =
      kindRaw === "product" && stockRaw !== null ? stockRaw : 0;
    const active = parseBooleanCell(cellAt(values, activeIdx), true);

    const validated = validateCatalogCreate({
      kind: kindRaw,
      name,
      description,
      sku,
      unit_price: price,
      initial_stock,
      active,
    });

    if (!validated.ok) {
      skipped += 1;
      continue;
    }

    rows.push({
      ...validated.value,
      line: i + 1,
    });
  }

  return { rows, skipped };
}

/** Simple CSV line parse (handles quoted fields). */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}
