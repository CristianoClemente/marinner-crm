"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  GraduationCap,
  Link2,
  Mail,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useCan } from "@/hooks/use-can";
import { formatDate } from "@/lib/format";
import type { ChaCategory, Instructor, InstructorStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GatedButton } from "@/components/ui/gated-button";
import { StateCard } from "@/components/ui/state-card";
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
import { ChaBadge } from "@/components/instructors/cha-badge";
import { InstructorForm } from "@/components/instructors/instructor-form";
import {
  createInstructorInvite,
  InviteResultDialog,
  LinkMemberDialog,
} from "@/components/instructors/instructor-access-dialogs";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | InstructorStatus;

export default function InstructorsPage() {
  const t = useTranslations("Instructors");
  const canManage = useCan("edit-settings");

  const [items, setItems] = useState<Instructor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Instructor | null>(null);
  const [linkTarget, setLinkTarget] = useState<Instructor | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const res = await fetch(`/api/instructors?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("loadError"));
      setItems(data.instructors ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    }
  }, [query, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const base = { all: items?.length ?? 0, active: 0, inactive: 0 };
    for (const i of items ?? []) base[i.status] += 1;
    return base;
  }, [items]);

  const visible = useMemo(
    () =>
      (items ?? []).filter((i) => status === "all" || i.status === status),
    [items, status],
  );

  function labelStatus(s: InstructorStatus) {
    return s === "active" ? t("statusActive") : t("statusInactive");
  }

  function labelChaCategory(c: ChaCategory) {
    return t(`chaCategory.${c}`);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(item: Instructor) {
    setEditing(item);
    setFormOpen(true);
  }

  async function deactivate(item: Instructor) {
    try {
      const res = await fetch(`/api/instructors/${item.id}`, {
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

  async function sendInvite(item: Instructor) {
    if (item.user_id) {
      toast.error(t("alreadyLinkedToast"));
      return;
    }
    try {
      const url = await createInstructorInvite(item.id);
      setInviteName(item.full_name);
      setInviteUrl(url);
      setInviteOpen(true);
      toast.success(t("form.inviteCreated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("form.inviteError"));
    }
  }

  function openLink(item: Instructor) {
    if (item.user_id) {
      toast.error(t("alreadyLinkedToast"));
      return;
    }
    setLinkTarget(item);
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
          gateReason="gerenciar instrutores"
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
                  {t("colCha")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">
                  {t("colChaCategory")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden lg:table-cell">
                  {t("colChaExpires")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden sm:table-cell">
                  {t("colStatus")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden xl:table-cell">
                  {t("colLogin")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden xl:table-cell text-right">
                  {t("colLocations")}
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
                  <TableCell className="hidden md:table-cell">
                    <span className="block h-3 w-16 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="block h-3 w-20 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="block h-3 w-14 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <span className="block h-3 w-16 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <span className="ml-auto block h-3 w-8 animate-pulse rounded bg-muted" />
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
            icon={<GraduationCap />}
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
                  {t("colCha")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">
                  {t("colChaCategory")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden lg:table-cell">
                  {t("colChaExpires")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden sm:table-cell">
                  {t("colStatus")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden xl:table-cell">
                  {t("colLogin")}
                </TableHead>
                <TableHead className="text-muted-foreground hidden xl:table-cell text-right">
                  {t("colLocations")}
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((item) => (
                <TableRow
                  key={item.id}
                  className={cn(
                    "border-border",
                    item.status === "inactive" && "opacity-60",
                  )}
                >
                  <TableCell>
                    <span className="block max-w-[12rem] truncate text-sm font-medium text-foreground">
                      {item.full_name}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1 lg:hidden">
                      <ChaBadge
                        expiresOn={item.cha_expires_on}
                        today={today}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {item.cha_number}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {labelChaCategory(item.cha_category)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatDate(item.cha_expires_on)}
                      </span>
                      <div className="hidden lg:flex">
                        <ChaBadge
                          expiresOn={item.cha_expires_on}
                          today={today}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline" className="text-[10px]">
                      {labelStatus(item.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                    {item.user_id ? t("loginYes") : t("loginNo")}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-right text-sm tabular-nums text-muted-foreground">
                    {item.locations_count ?? 0}
                  </TableCell>
                  <TableCell>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={t("actions")}
                            />
                          }
                        >
                          <MoreVertical className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(item)}>
                            <Pencil className="size-4" />
                            {t("edit")}
                          </DropdownMenuItem>
                          {!item.user_id && (
                            <>
                              <DropdownMenuItem
                                onClick={() => void sendInvite(item)}
                              >
                                <Mail className="size-4" />
                                {t("sendInvite")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openLink(item)}
                              >
                                <Link2 className="size-4" />
                                {t("linkMember")}
                              </DropdownMenuItem>
                            </>
                          )}
                          {item.status === "active" && (
                            <>
                              <DropdownMenuSeparator className="bg-border" />
                              <DropdownMenuItem
                                onClick={() => void deactivate(item)}
                              >
                                {t("deactivate")}
                              </DropdownMenuItem>
                            </>
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

      <InstructorForm
        open={formOpen}
        onOpenChange={setFormOpen}
        instructor={editing}
        onSaved={() => void load()}
      />
      <InviteResultDialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) setInviteUrl(null);
        }}
        url={inviteUrl}
        instructorName={inviteName}
      />
      <LinkMemberDialog
        open={!!linkTarget}
        onOpenChange={(open) => {
          if (!open) setLinkTarget(null);
        }}
        instructor={linkTarget}
        onLinked={() => void load()}
      />
    </div>
  );
}
