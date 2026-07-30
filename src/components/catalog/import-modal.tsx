"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle,
  Download,
  FileText,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { formatCurrency } from "@/lib/currency";
import {
  downloadCatalogCsvTemplate,
  parseCatalogCsv,
  type ParsedCatalogRow,
} from "@/lib/catalog/parse-catalog-csv";
import { cn } from "@/lib/utils";
import type { CatalogItem } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PREVIEW_LIMIT = 5;

function truncateFilename(name: string, max = 48): string {
  if (name.length <= max) return name;
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const base = name.slice(0, name.length - ext.length);
  const keep = max - ext.length - 1;
  return `${base.slice(0, Math.max(keep, 12))}…${ext}`;
}

interface CatalogImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function CatalogImportModal({
  open,
  onOpenChange,
  onImported,
}: CatalogImportModalProps) {
  const t = useTranslations("Catalog.importModal");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCatalogRow[]>([]);
  const [parseSkipped, setParseSkipped] = useState(0);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    failed: number;
  } | null>(null);

  function reset() {
    setFile(null);
    setParsedRows([]);
    setParseSkipped(0);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setResult(null);

    const text = await selected.text();
    const { rows, skipped } = parseCatalogCsv(text);

    if (rows.length === 0) {
      toast.error(t("toastNoValidRows"));
      setParsedRows([]);
      setParseSkipped(skipped);
      return;
    }

    setParsedRows(rows);
    setParseSkipped(skipped);
  }

  const preview = useMemo(
    () => parsedRows.slice(0, PREVIEW_LIMIT),
    [parsedRows],
  );

  async function handleImport() {
    if (parsedRows.length === 0) return;
    setImporting(true);
    setResult(null);

    let created = 0;
    let updated = 0;
    let failed = 0;

    try {
      const listRes = await fetch("/api/catalog");
      const listData = await listRes.json();
      if (!listRes.ok) {
        throw new Error(listData.error || t("toastError"));
      }

      const bySku = new Map<string, CatalogItem>();
      for (const item of (listData.items ?? []) as CatalogItem[]) {
        if (item.sku) bySku.set(item.sku.toUpperCase(), item);
      }

      for (const row of parsedRows) {
        try {
          const existing = row.sku ? bySku.get(row.sku) : undefined;
          if (existing) {
            const res = await fetch(`/api/catalog/${existing.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: row.name,
                description: row.description,
                unit_price: row.unit_price,
                active: row.active,
              }),
            });
            if (!res.ok) {
              failed += 1;
              continue;
            }
            updated += 1;
          } else {
            const res = await fetch("/api/catalog", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                kind: row.kind,
                name: row.name,
                description: row.description,
                sku: row.sku,
                unit_price: row.unit_price,
                initial_stock: row.initial_stock,
                active: row.active,
              }),
            });
            const data = await res.json();
            if (!res.ok) {
              failed += 1;
              continue;
            }
            created += 1;
            if (data.item?.sku) {
              bySku.set(String(data.item.sku).toUpperCase(), data.item);
            }
          }
        } catch {
          failed += 1;
        }
      }

      setResult({ created, updated, failed });
      if (created + updated > 0) {
        toast.success(
          t("toastImported", { count: created + updated }),
        );
        onImported();
      } else if (failed > 0) {
        toast.error(t("toastFailed", { count: failed }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toastError"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60dvh] space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCatalogCsvTemplate(t("templateFilename"))
              }
            >
              <Download className="size-4" />
              {t("downloadTemplate")}
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => void handleFileChange(e)}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center transition-colors hover:bg-muted/50",
            )}
          >
            {file ? (
              <>
                <FileText className="size-8 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {truncateFilename(file.name)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("rowsReady", { count: parsedRows.length })}
                  {parseSkipped > 0
                    ? ` · ${t("rowsSkipped", { count: parseSkipped })}`
                    : ""}
                </span>
              </>
            ) : (
              <>
                <Upload className="size-8 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {t("uploadDropzone")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("uploadHint")}
                </span>
              </>
            )}
          </button>

          {preview.length > 0 && !result && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t("preview", { count: preview.length })}
              </p>
              <div className="overflow-hidden rounded-xl border border-border ring-1 ring-border/50">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[28rem] text-xs">
                    <thead>
                      <tr className="border-b border-border bg-background/60">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          {t("columns.kind")}
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          {t("columns.name")}
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          {t("columns.sku")}
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                          {t("columns.price")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {preview.map((row) => (
                        <tr key={`${row.line}-${row.name}`}>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.kind === "product"
                              ? t("kindProduct")
                              : t("kindService")}
                          </td>
                          <td className="max-w-[10rem] truncate px-3 py-2 text-foreground">
                            {row.name}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                            {row.sku || "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-foreground">
                            {formatCurrency(row.unit_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {parsedRows.length > PREVIEW_LIMIT && (
                <p className="text-center text-[11px] text-muted-foreground">
                  {t("moreRows", {
                    count: parsedRows.length - PREVIEW_LIMIT,
                  })}
                </p>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {t("importComplete")}
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {result.created > 0 && (
                  <li className="flex items-center gap-2">
                    <CheckCircle className="size-3.5 text-primary" />
                    {t("resultCreated", { count: result.created })}
                  </li>
                )}
                {result.updated > 0 && (
                  <li className="flex items-center gap-2">
                    <CheckCircle className="size-3.5 text-primary" />
                    {t("resultUpdated", { count: result.updated })}
                  </li>
                )}
                {result.failed > 0 && (
                  <li className="flex items-center gap-2">
                    <XCircle className="size-3.5 text-destructive" />
                    {t("resultFailed", { count: result.failed })}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            disabled={importing}
            onClick={() => handleOpenChange(false)}
          >
            {result ? t("close") : t("cancel")}
          </Button>
          {!result && (
            <Button
              type="button"
              disabled={parsedRows.length === 0 || importing}
              onClick={() => void handleImport()}
            >
              {importing && <Loader2 className="size-4 animate-spin" />}
              {t("importBtn", { count: parsedRows.length })}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
