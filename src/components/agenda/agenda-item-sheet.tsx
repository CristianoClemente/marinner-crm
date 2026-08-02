"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

import {
  AGENDA_COLOR_CLASS,
  AGENDA_COLOR_KEYS,
  type AgendaColorKey,
  type AgendaEvent,
  type AgendaEventKind,
} from "@/lib/agenda/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type MemberOpt = {
  user_id: string;
  full_name: string;
};

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(local: string): string {
  return new Date(local).toISOString();
}

interface AgendaItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: AgendaEventKind;
  eventId: string | null;
  defaultStartsAt?: string | null;
  canManage: boolean;
  onSaved: () => void;
}

export function AgendaItemSheet({
  open,
  onOpenChange,
  kind,
  eventId,
  defaultStartsAt,
  canManage,
  onSaved,
}: AgendaItemSheetProps) {
  const t = useTranslations("Agenda");
  const isCreate = !eventId;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [event, setEvent] = useState<AgendaEvent | null>(null);
  const [members, setMembers] = useState<MemberOpt[]>([]);

  const [title, setTitle] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [endsAtLocal, setEndsAtLocal] = useState("");
  const [colorKey, setColorKey] = useState<AgendaColorKey>("orange");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const resetCreate = useCallback(() => {
    setEvent(null);
    setTitle("");
    setColorKey(kind === "reminder" ? "sky" : "violet");
    setAssigneeIds([]);
    setNotes("");
    setEndsAtLocal("");
    const base = defaultStartsAt ? new Date(defaultStartsAt) : new Date();
    if (!defaultStartsAt) base.setHours(9, 0, 0, 0);
    setStartsAtLocal(toLocalInputValue(base.toISOString()));
    if (kind === "event") {
      const end = new Date(base);
      end.setHours(end.getHours() + 1);
      setEndsAtLocal(toLocalInputValue(end.toISOString()));
    }
  }, [defaultStartsAt, kind]);

  const reloadEvent = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agenda/events/${eventId}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t("loadFailed"));
      const row = json.event as AgendaEvent;
      setEvent(row);
      setTitle(row.title);
      setStartsAtLocal(toLocalInputValue(row.starts_at));
      setEndsAtLocal(row.ends_at ? toLocalInputValue(row.ends_at) : "");
      setColorKey(row.color_key);
      setAssigneeIds((row.assignees ?? []).map((a) => a.user_id));
      setNotes(row.notes ?? "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [eventId, t]);

  useEffect(() => {
    if (!open) return;

    const ac = new AbortController();
    let alive = true;

    if (!eventId) resetCreate();

    void (async () => {
      try {
        const res = await fetch("/api/account/members", { signal: ac.signal });
        if (!alive) return;
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.ok) {
          setMembers(
            ((json.members ?? []) as MemberOpt[]).map((m) => ({
              user_id: m.user_id,
              full_name: m.full_name || t("assigneeFallback"),
            })),
          );
        }
      } catch {
        // Abort / fechar sheet
      }
    })();

    if (eventId) {
      setLoading(true);
      setEvent((prev) => (prev?.id === eventId ? prev : null));
      void (async () => {
        try {
          const res = await fetch(`/api/agenda/events/${eventId}`, {
            signal: ac.signal,
          });
          if (!alive) return;
          const json = await res.json().catch(() => ({}));
          if (!alive) return;
          if (!res.ok) throw new Error(json.error || t("loadFailed"));
          const row = json.event as AgendaEvent;
          setEvent(row);
          setTitle(row.title);
          setStartsAtLocal(toLocalInputValue(row.starts_at));
          setEndsAtLocal(row.ends_at ? toLocalInputValue(row.ends_at) : "");
          setColorKey(row.color_key);
          setAssigneeIds((row.assignees ?? []).map((a) => a.user_id));
          setNotes(row.notes ?? "");
        } catch (err) {
          if (!alive || ac.signal.aborted) return;
          toast.error(err instanceof Error ? err.message : t("loadFailed"));
        } finally {
          if (alive) setLoading(false);
        }
      })();
    }

    return () => {
      alive = false;
      ac.abort();
    };
  }, [open, eventId, resetCreate, t]);

  const effectiveKind = event?.kind ?? kind;
  const readOnly = !canManage || event?.status === "canceled";

  function toggleAssignee(userId: string, checked: boolean) {
    setAssigneeIds((prev) => {
      if (checked) {
        return prev.includes(userId) ? prev : [...prev, userId];
      }
      return prev.filter((id) => id !== userId);
    });
  }

  async function save() {
    if (!canManage) return;
    if (!title.trim() || !startsAtLocal) {
      toast.error(t("itemRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        starts_at: fromLocalInputValue(startsAtLocal),
        ends_at:
          effectiveKind === "event" && endsAtLocal
            ? fromLocalInputValue(endsAtLocal)
            : null,
        color_key: colorKey,
        assignee_user_ids: assigneeIds,
        notes: notes.trim() || null,
      };

      if (isCreate) {
        const res = await fetch("/api/agenda/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, kind: effectiveKind }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || t("saveFailed"));
        toast.success(t("itemCreateSuccess"));
        onSaved();
        onOpenChange(false);
      } else if (eventId) {
        const res = await fetch(`/api/agenda/events/${eventId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || t("saveFailed"));
        toast.success(t("itemSaveSuccess"));
        onSaved();
        await reloadEvent();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: "active" | "canceled") {
    if (!eventId || !canManage) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/agenda/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t("saveFailed"));
      toast.success(
        status === "canceled" ? t("itemCanceled") : t("itemReopened"),
      );
      onSaved();
      await reloadEvent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const kindLabel =
    effectiveKind === "reminder" ? t("kindReminder") : t("kindEvent");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-border pr-12">
          <div className="flex items-center gap-2">
            <SheetTitle className="min-w-0 truncate">
              {isCreate
                ? effectiveKind === "reminder"
                  ? t("createReminder")
                  : t("createEvent")
                : title.trim() || kindLabel}
            </SheetTitle>
            {event ? (
              <Badge
                variant={
                  event.status === "canceled" ? "destructive" : "outline"
                }
              >
                {event.status === "canceled"
                  ? t("statusCanceled")
                  : kindLabel}
              </Badge>
            ) : (
              <Badge variant="outline">{kindLabel}</Badge>
            )}
          </div>
          <SheetDescription className="truncate">
            {isCreate
              ? t("itemCreateHint")
              : event
                ? formatDateTime(event.starts_at)
                : t("loading")}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4">
          {loading && !event && !isCreate ? (
            <div className="space-y-3 pt-1">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-9 w-full animate-pulse rounded-lg bg-muted/60" />
              <div className="h-24 w-full animate-pulse rounded-lg bg-muted/60" />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("itemTitle")}
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("itemTitlePlaceholder")}
                  disabled={readOnly}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("startsAt")}
                </Label>
                <DateTimePicker
                  value={startsAtLocal}
                  onChange={setStartsAtLocal}
                  disabled={readOnly}
                  placeholder={t("dateTimePlaceholder")}
                  timeLabel={t("timeLabel")}
                />
              </div>

              {effectiveKind === "event" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t("endsAt")}
                  </Label>
                  <DateTimePicker
                    value={endsAtLocal}
                    onChange={setEndsAtLocal}
                    disabled={readOnly}
                    placeholder={t("dateTimePlaceholder")}
                    timeLabel={t("timeLabel")}
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("color")}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {AGENDA_COLOR_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      disabled={readOnly}
                      aria-label={t("colorOption", { color: key })}
                      aria-pressed={colorKey === key}
                      onClick={() => setColorKey(key)}
                      className={cn(
                        "size-7 rounded-full ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        AGENDA_COLOR_CLASS[key].swatch,
                        colorKey === key
                          ? "ring-2 ring-foreground/80 ring-offset-2"
                          : "opacity-80 hover:opacity-100",
                      )}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t("assignees")}
                  </Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {assigneeIds.length > 0
                      ? t("assigneesCount", { count: assigneeIds.length })
                      : t("assigneeNone")}
                  </span>
                </div>
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("assigneesEmpty")}
                  </p>
                ) : (
                  <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                    {members.map((m) => {
                      const checked = assigneeIds.includes(m.user_id);
                      return (
                        <li key={m.user_id}>
                          <label
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                              readOnly
                                ? "cursor-default opacity-70"
                                : "cursor-pointer hover:bg-muted/60",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={readOnly}
                              onCheckedChange={(v) =>
                                toggleAssignee(m.user_id, v === true)
                              }
                            />
                            <span className="min-w-0 truncate">
                              {m.full_name}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("notes")}
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("notesPlaceholder")}
                  disabled={readOnly}
                  rows={4}
                />
              </div>

              {canManage && event?.status === "active" ? (
                <div className="border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={saving}
                    onClick={() => void setStatus("canceled")}
                  >
                    <X />
                    {t("cancelItem")}
                  </Button>
                </div>
              ) : null}

              {canManage && event?.status === "canceled" ? (
                <div className="border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void setStatus("active")}
                  >
                    {t("reopen")}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>

        {canManage && !readOnly ? (
          <SheetFooter className="shrink-0 border-t border-border">
            <Button
              type="button"
              disabled={saving || loading}
              onClick={() => void save()}
            >
              {saving ? <Loader2 className="animate-spin" /> : null}
              {isCreate ? t("createItem") : t("save")}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
