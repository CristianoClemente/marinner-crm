"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { formatCurrency } from "@/lib/currency";
import { useCan } from "@/hooks/use-can";
import type {
  ClassLocation,
  ClassLocationCostType,
  ClassLocationStatus,
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
import { ClassLocationForm } from "@/components/class-locations/location-form";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | ClassLocationStatus;

export default function ClassLocationsPage() {
  const t = useTranslations("ClassLocations");
  const canManage = useCan("edit-settings");

  const [locations, setLocations] = useState<ClassLocation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClassLocation | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const res = await fetch(`/api/class-locations?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("loadError"));
      setLocations(data.locations ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    }
  }, [query, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const base = { all: locations?.length ?? 0, active: 0, inactive: 0 };
    for (const loc of locations ?? []) base[loc.status] += 1;
    return base;
  }, [locations]);

  const visible = useMemo(
    () =>
      (locations ?? []).filter(
        (loc) => status === "all" || loc.status === status,
      ),
    [locations, status],
  );

  function costLabel(type: ClassLocationCostType) {
    switch (type) {
      case "monthly_fee":
        return t("costMonthly");
      case "per_class":
        return t("costPerClass");
      case "per_day":
        return t("costPerDay");
      case "per_student":
        return t("costPerStudent");
    }
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(loc: ClassLocation) {
    setEditing(loc);
    setFormOpen(true);
  }

  async function deactivate(loc: ClassLocation) {
    try {
      const res = await fetch(`/api/class-locations/${loc.id}`, {
        method: "DELETE",
      });
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
          gateReason="gerenciar locais de aula"
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
              ["active", t("filterActive")],
              ["inactive", t("filterInactive")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
              className={cn(
                "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors sm:min-h-7 sm:flex-none",
                status === value
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
      ) : locations === null ? (
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
                  {t("colCity")}
                </TableHead>
                <TableHead className="text-muted-foreground">
                  {t("colStatus")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden sm:table-cell">
                  {t("colExpense")}
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
                    <span className="block h-3 w-14 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="block h-3 w-24 animate-pulse rounded bg-muted" />
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
            icon={<MapPin />}
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
                  setStatus("all");
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
                  {t("colCity")}
                </TableHead>
                <TableHead className="text-muted-foreground">
                  {t("colStatus")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden sm:table-cell">
                  {t("colExpense")}
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((loc) => (
                <TableRow
                  key={loc.id}
                  className={cn(
                    "border-border",
                    loc.status === "inactive" && "opacity-60",
                  )}
                >
                  <TableCell>
                    <span className="block max-w-[14rem] truncate text-sm font-medium text-foreground">
                      {loc.name}
                    </span>
                    <span className="text-muted-foreground text-xs md:hidden">
                      {loc.cidade || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                    {loc.cidade || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-muted-foreground">
                      {loc.status === "active"
                        ? t("statusActive")
                        : t("statusInactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {loc.has_expense && loc.expense_type ? (
                      <span className="text-sm tabular-nums text-foreground">
                        {costLabel(loc.expense_type)} ·{" "}
                        {formatCurrency(Number(loc.expense_amount ?? 0))}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t("noExpense")}
                      </span>
                    )}
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
                          <DropdownMenuItem onClick={() => openEdit(loc)}>
                            <Pencil className="size-4" />
                            {t("edit")}
                          </DropdownMenuItem>
                          {loc.status === "active" && (
                            <DropdownMenuItem
                              onClick={() => void deactivate(loc)}
                            >
                              {t("deactivate")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ClassLocationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        location={editing}
        onSaved={() => void load()}
      />
    </div>
  );
}
