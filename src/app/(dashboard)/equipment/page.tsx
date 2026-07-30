"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SearchX,
  Ship,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { formatNumber } from "@/lib/format";
import { buildEquipmentAlerts } from "@/lib/equipment/alerts";
import { useCan } from "@/hooks/use-can";
import type {
  Equipment,
  EquipmentKind,
  EquipmentStatus,
  EquipmentSubtype,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GatedButton } from "@/components/ui/gated-button";
import { StateCard } from "@/components/ui/state-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { EquipmentForm } from "@/components/equipment/equipment-form";
import { cn } from "@/lib/utils";

type KindFilter = "all" | EquipmentKind;

export default function EquipmentPage() {
  const t = useTranslations("Equipment");
  const canManage = useCan("edit-settings");

  const [items, setItems] = useState<Equipment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const res = await fetch(`/api/equipment?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("loadError"));
      setItems(data.equipment ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    }
  }, [query, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const base = { all: items?.length ?? 0, vehicle: 0, vessel: 0 };
    for (const e of items ?? []) base[e.kind] += 1;
    return base;
  }, [items]);

  const visible = useMemo(
    () => (items ?? []).filter((e) => kind === "all" || e.kind === kind),
    [items, kind],
  );

  function labelSubtype(s: EquipmentSubtype) {
    return t(`form.subtype.${s}`);
  }

  function labelStatus(s: EquipmentStatus) {
    return t(`form.status.${s}`);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(item: Equipment) {
    setEditing(item);
    setFormOpen(true);
  }

  async function deactivate(item: Equipment) {
    try {
      const res = await fetch(`/api/equipment/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("deactivateError"));
      toast.success(t("deactivated"));
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("deactivateError"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <GatedButton
          canAct={canManage}
          gateReason="gerenciar a frota"
          onClick={openCreate}
          aria-label={t("add")}
          className="relative size-9 shrink-0 p-0 after:absolute after:-inset-1 sm:h-8 sm:w-auto sm:px-2.5 sm:after:hidden"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">{t("add")}</span>
        </GatedButton>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-9 border-border bg-card pr-9 pl-8 text-base sm:h-8 md:text-sm"
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
          className="flex items-center gap-1 overflow-x-auto rounded-lg bg-muted p-[3px] sm:ml-auto"
        >
          {(
            [
              ["all", t("filterAll")],
              ["vehicle", t("filterVehicle")],
              ["vessel", t("filterVessel")],
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
              <span className="text-xs tabular-nums opacity-60">
                {counts[value]}
              </span>
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
                  {t("colType")}
                </TableHead>
                <TableHead className="text-muted-foreground">
                  {t("colPlate")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden sm:table-cell">
                  {t("colStatus")}
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[0, 1, 2].map((i) => (
                <TableRow key={i} className="border-border">
                  <TableCell>
                    <span className="block h-3.5 w-36 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="block h-3 w-20 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell>
                    <span className="block h-3 w-16 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="block h-3 w-14 animate-pulse rounded bg-muted" />
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
            icon={<Ship />}
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
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setKind("all");
                }}
              >
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
                  {t("colType")}
                </TableHead>
                <TableHead className="text-muted-foreground">
                  {t("colPlate")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden lg:table-cell text-right">
                  {t("colMeter")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden sm:table-cell">
                  {t("colStatus")}
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((item) => {
                const alerts = buildEquipmentAlerts({
                  document_expires_on: item.document_expires_on,
                  dpem_expires_on: item.dpem_expires_on,
                  next_maintenance_due_on: item.next_maintenance_due_on,
                  today,
                });
                return (
                  <TableRow
                    key={item.id}
                    className={cn(
                      "border-border",
                      item.status === "inactive" && "opacity-60",
                    )}
                  >
                    <TableCell>
                      <span className="block max-w-[12rem] truncate text-sm font-medium text-foreground">
                        {item.name}
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {alerts.document.level !== "ok" && (
                          <Badge
                            variant={
                              alerts.document.level === "overdue"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {t("alertDoc")}
                          </Badge>
                        )}
                        {alerts.dpem.level !== "ok" && (
                          <Badge
                            variant={
                              alerts.dpem.level === "overdue"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {t("alertDpem")}
                          </Badge>
                        )}
                        {alerts.nextMaintenance.level !== "ok" && (
                          <Badge
                            variant={
                              alerts.nextMaintenance.level === "overdue"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {t("alertMaint")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                      {labelSubtype(item.subtype)}
                    </TableCell>
                    <TableCell className="font-mono text-sm tabular-nums text-foreground">
                      {item.plate_or_registration}
                    </TableCell>
                    <TableCell className="hidden text-right text-sm tabular-nums text-foreground lg:table-cell">
                      {formatNumber(Number(item.meter_value))}{" "}
                      <span className="text-muted-foreground">
                        {item.meter_unit === "km"
                          ? t("form.unitKm")
                          : t("form.unitHours")}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="text-muted-foreground">
                        {labelStatus(item.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label={t("rowActions")}
                            className="text-muted-foreground hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted inline-flex size-9 items-center justify-center rounded-md transition-colors sm:size-8"
                          >
                            <MoreVertical className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(item)}>
                              <Pencil className="size-4" />
                              {t("edit")}
                            </DropdownMenuItem>
                            {item.status !== "inactive" && (
                              <DropdownMenuItem
                                onClick={() => void deactivate(item)}
                              >
                                {t("deactivate")}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <EquipmentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        equipment={editing}
        onSaved={() => void load()}
      />
    </div>
  );
}
