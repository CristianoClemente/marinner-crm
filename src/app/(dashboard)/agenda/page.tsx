"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import {
  AGENDA_COLOR_CLASS,
  type AgendaColorKey,
  type AgendaEvent,
  type AgendaEventKind,
} from "@/lib/agenda/types";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { useCan } from "@/hooks/use-can";
import type { ProcessClass } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AgendaItemSheet } from "@/components/agenda/agenda-item-sheet";
import { TurmaEventSheet } from "@/components/agenda/turma-event-sheet";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

type CalendarItem =
  | {
      source: "class";
      id: string;
      starts_at: string;
      title: string;
      subtitle?: string;
      status: ProcessClass["status"];
      class: ProcessClass;
    }
  | {
      source: "event";
      id: string;
      starts_at: string;
      title: string;
      subtitle?: string;
      status: AgendaEvent["status"];
      color_key: AgendaColorKey;
      kind: AgendaEventKind;
      event: AgendaEvent;
    };

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// `useSearchParams` (?day= deep link) requires a Suspense boundary.
export default function AgendaPage() {
  return (
    <Suspense fallback={null}>
      <AgendaPageInner />
    </Suspense>
  );
}

function AgendaPageInner() {
  const t = useTranslations("Agenda");
  const canManage = useCan("edit-settings");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [classes, setClasses] = useState<ProcessClass[]>([]);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [turmaOpen, setTurmaOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);
  const [itemKind, setItemKind] = useState<AgendaEventKind>("reminder");
  const [createDefaultStarts, setCreateDefaultStarts] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const day = searchParams.get("day");
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    const parsed = new Date(`${day}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return;
    setSelectedDay(parsed);
    setCursor(startOfMonth(parsed));
  }, [searchParams]);

  const range = useMemo(() => {
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [cursor]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          from: range.from,
          to: range.to,
        });
        const [cRes, eRes] = await Promise.all([
          fetch(`/api/classes?${params}`, { signal }),
          fetch(`/api/agenda/events?${params}`, { signal }),
        ]);
        const cJson = await cRes.json().catch(() => ({}));
        const eJson = await eRes.json().catch(() => ({}));
        if (!cRes.ok) throw new Error(cJson.error || t("loadFailed"));
        if (!eRes.ok) throw new Error(eJson.error || t("loadFailed"));
        setClasses((cJson.classes ?? []) as ProcessClass[]);
        setEvents((eJson.events ?? []) as AgendaEvent[]);
      } catch (err) {
        if (signal?.aborted) return;
        toast.error(err instanceof Error ? err.message : t("loadFailed"));
        setClasses([]);
        setEvents([]);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [range.from, range.to, t],
  );

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const items: CalendarItem[] = useMemo(() => {
    const classItems: CalendarItem[] = classes.map((c) => ({
      source: "class",
      id: c.id,
      starts_at: c.starts_at,
      title:
        c.name ||
        c.template?.catalog_item?.name ||
        c.template_stage?.name ||
        t("eventKind"),
      subtitle: c.location?.name ?? undefined,
      status: c.status,
      class: c,
    }));
    const eventItems: CalendarItem[] = events.map((e) => {
      const names = (e.assignees ?? [])
        .map((a) => a.full_name?.trim())
        .filter(Boolean) as string[];
      let subtitle =
        e.kind === "reminder" ? t("kindReminder") : t("kindEvent");
      if (names.length === 1) subtitle = names[0];
      else if (names.length > 1) {
        subtitle = t("assigneesSummary", {
          first: names[0],
          count: names.length - 1,
        });
      }
      return {
        source: "event" as const,
        id: e.id,
        starts_at: e.starts_at,
        title: e.title,
        subtitle,
        status: e.status,
        color_key: e.color_key,
        kind: e.kind,
        event: e,
      };
    });
    return [...classItems, ...eventItems].sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
  }, [classes, events, t]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const key = dayKey(new Date(item.starts_at));
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [items]);

  const calendarCells = useMemo(() => {
    const first = startOfMonth(cursor);
    const startPad = first.getDay();
    const daysInMonth = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0,
    ).getDate();
    const cells: Array<{ date: Date; inMonth: boolean } | null> = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({
        date: new Date(cursor.getFullYear(), cursor.getMonth(), day),
        inMonth: true,
      });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const dayItems = byDay.get(dayKey(selectedDay)) ?? [];

  function defaultStartsFor(day?: Date): string {
    const base = day ? new Date(day) : new Date(selectedDay);
    base.setHours(9, 0, 0, 0);
    return base.toISOString();
  }

  function openCreateTurma(day?: Date) {
    setCreateDefaultStarts(defaultStartsFor(day));
    setTurmaOpen(true);
  }

  function openCreateItem(kind: AgendaEventKind, day?: Date) {
    setItemKind(kind);
    setItemId(null);
    setCreateDefaultStarts(defaultStartsFor(day));
    setItemOpen(true);
  }

  function openItem(item: CalendarItem) {
    if (item.source === "class") {
      router.push(`/agenda/turmas/${item.id}`);
      return;
    }
    setItemKind(item.kind);
    setItemId(item.id);
    setCreateDefaultStarts(null);
    setItemOpen(true);
  }

  function NewMenu({ day }: { day?: Date }) {
    if (!canManage) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            day
              ? "h-7 border border-border bg-background px-2.5 hover:bg-muted"
              : "h-8 bg-primary px-2.5 text-primary-foreground hover:bg-primary/80",
          )}
        >
          <Plus className="size-3.5" />
          {day ? t("add") : t("new")}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onClick={() => openCreateTurma(day)}>
            <GraduationCap />
            {t("kindClass")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openCreateItem("reminder", day)}>
            <Bell />
            {t("kindReminder")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openCreateItem("event", day)}>
            <CalendarDays />
            {t("kindEvent")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <NewMenu />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_320px]">
        <section className="rounded-xl border border-border bg-card p-3 md:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setCursor((c) => addMonths(c, -1))}
              aria-label={t("prevMonth")}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <h2 className="text-sm font-medium capitalize">
              {formatDate(cursor, { month: "long", year: "numeric" })}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              aria-label={t("nextMonth")}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1 font-medium">
                {d}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <div className="mt-1 grid grid-cols-7 gap-1">
              {calendarCells.map((cell, idx) => {
                if (!cell) {
                  return <div key={`empty-${idx}`} className="min-h-16" />;
                }
                const key = dayKey(cell.date);
                const dayList = byDay.get(key) ?? [];
                const selected = sameDay(cell.date, selectedDay);
                const today = sameDay(cell.date, new Date());
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDay(cell.date)}
                    className={cn(
                      "flex min-h-16 flex-col gap-0.5 rounded-lg border p-1.5 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:bg-muted/60",
                      today && !selected && "border-border",
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-medium",
                        today && "text-primary",
                      )}
                    >
                      {cell.date.getDate()}
                    </span>
                    {dayList.slice(0, 2).map((item) => (
                      <span
                        key={`${item.source}-${item.id}`}
                        className={cn(
                          "truncate rounded px-1 text-[10px] leading-4",
                          item.source === "event"
                            ? AGENDA_COLOR_CLASS[item.color_key].chip
                            : "bg-muted text-foreground",
                          item.status === "canceled" && "opacity-50 line-through",
                        )}
                      >
                        {formatDateTime(item.starts_at, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        {item.title}
                      </span>
                    ))}
                    {dayList.length > 2 ? (
                      <span className="text-[10px] text-muted-foreground">
                        +{formatNumber(dayList.length - 2)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="flex flex-col rounded-xl border border-border bg-card p-3 md:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium capitalize">
              {formatDate(selectedDay, {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
            </h2>
            <NewMenu day={selectedDay} />
          </div>

          <ul className="flex-1 space-y-2 overflow-y-auto">
            {dayItems.length === 0 ? (
              <li className="py-8 text-center text-sm text-muted-foreground">
                {t("dayEmpty")}
              </li>
            ) : (
              dayItems.map((item) => (
                <li key={`${item.source}-${item.id}`}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted/50"
                    onClick={() => openItem(item)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(item.starts_at, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {item.subtitle ? ` · ${item.subtitle}` : ""}
                        </p>
                      </div>
                      {item.source === "class" ? (
                        <Badge
                          variant={
                            item.status === "canceled"
                              ? "outline"
                              : item.status === "closed"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {t("kindClass")}
                        </Badge>
                      ) : (
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                            AGENDA_COLOR_CLASS[item.color_key].chip,
                          )}
                        >
                          {item.kind === "reminder"
                            ? t("kindReminder")
                            : t("kindEvent")}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>

      <TurmaEventSheet
        open={turmaOpen}
        onOpenChange={setTurmaOpen}
        defaultStartsAt={createDefaultStarts}
        canManage={canManage}
        onCreated={(id) => {
          void load();
          router.push(`/agenda/turmas/${id}`);
        }}
      />
      <AgendaItemSheet
        open={itemOpen}
        onOpenChange={setItemOpen}
        kind={itemKind}
        eventId={itemId}
        defaultStartsAt={createDefaultStarts}
        canManage={canManage}
        onSaved={() => void load()}
      />
    </div>
  );
}
