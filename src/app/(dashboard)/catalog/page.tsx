"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  Boxes,
  Loader2,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SearchX,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { formatCurrency } from "@/lib/currency";
import { formatNumber } from "@/lib/format";
import { useCan } from "@/hooks/use-can";
import type { CatalogItem, CatalogItemKind } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GatedButton } from "@/components/ui/gated-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StateCard } from "@/components/ui/state-card";
import { CatalogItemForm } from "@/components/catalog/catalog-item-form";
import { CatalogImportModal } from "@/components/catalog/import-modal";
import { CatalogStockPanel } from "@/components/catalog/catalog-stock-panel";
import { cn } from "@/lib/utils";

type KindFilter = "all" | CatalogItemKind;

export default function CatalogPage() {
  const t = useTranslations("Catalog");
  const canManage = useCan("edit-settings");

  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Consulta com debounce: a busca vai ao servidor, então digitar não pode
  // disparar uma requisição por tecla.
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [stockItem, setStockItem] = useState<CatalogItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CatalogItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const res = await fetch(`/api/catalog?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("loadError"));
      setItems(data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    }
  }, [query, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // O tipo filtra no cliente: mantém a troca instantânea e permite contar
  // quantos itens existem em cada aba do resultado atual.
  const counts = useMemo(
    () => ({
      all: items?.length ?? 0,
      product: items?.filter((i) => i.kind === "product").length ?? 0,
      service: items?.filter((i) => i.kind === "service").length ?? 0,
    }),
    [items],
  );

  const visible = useMemo(
    () => (items ?? []).filter((i) => kind === "all" || i.kind === kind),
    [items, kind],
  );

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(item: CatalogItem) {
    setEditing(item);
    setFormOpen(true);
  }

  function clearFilters() {
    setSearch("");
    setKind("all");
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/catalog/${pendingDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("deleteError"));
      toast.success(data.soft_deleted ? t("deactivated") : t("deleted"));
      setPendingDelete(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <GatedButton
            variant="outline"
            canAct={canManage}
            gateReason="gerenciar o catálogo"
            onClick={() => setImportOpen(true)}
            aria-label={t("importBtn")}
            className="relative size-9 shrink-0 border-border p-0 text-muted-foreground after:absolute after:-inset-1 hover:bg-muted sm:h-8 sm:w-auto sm:px-2.5 sm:after:hidden"
          >
            <Upload className="size-4" />
            <span className="hidden sm:inline">{t("importBtn")}</span>
          </GatedButton>
          <GatedButton
            canAct={canManage}
            gateReason="gerenciar o catálogo"
            onClick={openCreate}
            aria-label={t("add")}
            className="relative size-9 shrink-0 p-0 after:absolute after:-inset-1 sm:h-8 sm:w-auto sm:px-2.5 sm:after:hidden"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t("add")}</span>
          </GatedButton>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-9 border-border bg-card pr-9 pl-8 text-base md:text-sm sm:h-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label={t("clearSearch")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded text-muted-foreground transition-colors after:absolute after:-inset-2 hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div
          role="group"
          aria-label={t("filterAria")}
          className="flex items-center gap-1 rounded-lg bg-muted p-[3px] sm:ml-auto"
        >
          {(
            [
              ["all", t("filterAll")],
              ["product", t("filterProducts")],
              ["service", t("filterServices")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              className={cn(
                "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors sm:min-h-7 sm:flex-none",
                kind === value
                  ? "bg-background text-foreground shadow-sm dark:bg-input/40"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              {items !== null && (
                <span className="text-xs tabular-nums opacity-60">
                  {counts[value]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <StateCard
          tone="destructive"
          icon={<AlertCircle />}
          title={t("loadError")}
          description={error}
          action={
            <Button variant="outline" onClick={() => void load()}>
              <RotateCcw className="size-4" />
              {t("retry")}
            </Button>
          }
        />
      ) : items === null ? (
        <div
          aria-busy
          className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
        >
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">
                  {t("colName")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">
                  {t("colKind")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden lg:table-cell">
                  {t("colSku")}
                </TableHead>
                <TableHead className="text-muted-foreground text-right">
                  {t("colPrice")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden sm:table-cell text-right">
                  {t("colStock")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">
                  {t("colStatus")}
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[0, 1, 2, 3].map((i) => (
                <TableRow key={i} className="border-border">
                  <TableCell>
                    <span className="block h-3.5 w-36 max-w-[55%] animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="block h-3 w-16 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="block h-3 w-14 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell>
                    <span className="ml-auto block h-3.5 w-14 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="ml-auto block h-3 w-10 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="block h-3 w-12 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : visible.length === 0 ? (
        counts.all === 0 && !query ? (
          <StateCard
            tone="primary"
            icon={<Package />}
            title={t("emptyTitle")}
            description={t("emptyDesc")}
            action={
              canManage ? (
                <Button onClick={openCreate}>
                  <Plus className="size-4" />
                  {t("emptyCta")}
                </Button>
              ) : null
            }
          />
        ) : (
          <StateCard
            tone="muted"
            icon={<SearchX />}
            title={t("noResultsTitle")}
            description={t("noResultsDesc")}
            action={
              <Button variant="outline" onClick={clearFilters}>
                {t("clearFilters")}
              </Button>
            }
          />
        )
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">
                  {t("colName")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">
                  {t("colKind")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden lg:table-cell">
                  {t("colSku")}
                </TableHead>
                <TableHead className="text-muted-foreground text-right">
                  {t("colPrice")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden sm:table-cell text-right">
                  {t("colStock")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">
                  {t("colStatus")}
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((item) => (
                <CatalogTableRow
                  key={item.id}
                  item={item}
                  canManage={canManage}
                  onEdit={() => openEdit(item)}
                  onStock={() => setStockItem(item)}
                  onDelete={() => setPendingDelete(item)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CatalogItemForm
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editing}
        onSaved={() => {
          setFormOpen(false);
          void load();
        }}
      />

      <CatalogImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void load()}
      />

      <CatalogStockPanel
        item={stockItem}
        open={!!stockItem}
        onOpenChange={(o) => !o && setStockItem(null)}
        onChanged={() => {
          void load();
        }}
      />

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteDesc", { name: pendingDelete?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {deleting ? t("deleting") : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CatalogTableRow({
  item,
  canManage,
  onEdit,
  onStock,
  onDelete,
}: {
  item: CatalogItem;
  canManage: boolean;
  onEdit: () => void;
  onStock: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("Catalog");
  const isProduct = item.kind === "product";

  return (
    <TableRow
      className={cn(
        "border-border",
        canManage && "cursor-pointer",
        !item.active && "opacity-70",
      )}
      onClick={canManage ? onEdit : undefined}
    >
      <TableCell className="text-foreground font-medium">
        <span className="block truncate">{item.name}</span>
        <span className="text-muted-foreground mt-0.5 block text-xs md:hidden">
          {isProduct ? t("kindProduct") : t("kindService")}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground hidden md:table-cell text-sm">
        {isProduct ? t("kindProduct") : t("kindService")}
      </TableCell>
      <TableCell className="text-muted-foreground hidden font-mono text-xs lg:table-cell">
        {item.sku || "—"}
      </TableCell>
      <TableCell className="text-foreground text-right text-sm font-semibold tabular-nums">
        {formatCurrency(item.unit_price)}
      </TableCell>
      <TableCell className="hidden text-right sm:table-cell">
        {isProduct ? (
          item.stock_qty <= 0 ? (
            <Badge
              variant="destructive"
              className="border-destructive/30 whitespace-nowrap"
            >
              {t("stockNone")}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm tabular-nums">
              {formatNumber(item.stock_qty)}
            </span>
          )
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {item.active ? (
          <span className="text-muted-foreground text-sm">{t("active")}</span>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            {t("inactive")}
          </Badge>
        )}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t("rowActions")}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted sm:size-8"
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="size-4" />
                {t("edit")}
              </DropdownMenuItem>
              {isProduct && (
                <DropdownMenuItem onClick={onStock}>
                  <Boxes className="size-4" />
                  {t("stockBtn")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="size-4" />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
}