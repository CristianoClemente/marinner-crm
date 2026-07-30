"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import type { InstructorUnavailability } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StateCard } from "@/components/ui/state-card";
import { AlertCircle } from "lucide-react";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export default function MyAvailabilityPage() {
  const t = useTranslations("MyAvailability");
  const { isInstructor, profileLoading } = useAuth();

  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [unavailability, setUnavailability] = useState<
    InstructorUnavailability[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingWeekly, setSavingWeekly] = useState(false);
  const [onDate, setOnDate] = useState("");
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [weekRes, unavRes] = await Promise.all([
        fetch("/api/instructors/me/weekly"),
        fetch("/api/instructors/me/unavailability"),
      ]);
      const weekData = await weekRes.json();
      const unavData = await unavRes.json();
      if (!weekRes.ok) throw new Error(weekData.error || t("loadError"));
      if (!unavRes.ok) throw new Error(unavData.error || t("loadError"));
      setWeekdays(
        (weekData.weekly ?? [])
          .filter((w: { active: boolean }) => w.active)
          .map((w: { weekday: number }) => w.weekday),
      );
      setUnavailability(unavData.unavailability ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (profileLoading) return;
    if (!isInstructor) {
      setLoading(false);
      return;
    }
    void load();
  }, [isInstructor, profileLoading, load]);

  function toggleWeekday(day: number) {
    setWeekdays((prev) =>
      prev.includes(day)
        ? prev.filter((x) => x !== day)
        : [...prev, day].sort((a, b) => a - b),
    );
  }

  async function saveWeekly() {
    setSavingWeekly(true);
    try {
      const res = await fetch("/api/instructors/me/weekly", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekdays }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("saveError"));
      setWeekdays(
        (data.weekly ?? []).map((w: { weekday: number }) => w.weekday),
      );
      toast.success(t("weeklySaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSavingWeekly(false);
    }
  }

  async function addException(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch("/api/instructors/me/unavailability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          on_date: onDate,
          reason: reason.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("saveError"));
      setUnavailability((prev) =>
        [...prev, data.unavailability].sort((a, b) =>
          a.on_date.localeCompare(b.on_date),
        ),
      );
      setOnDate("");
      setReason("");
      toast.success(t("exceptionAdded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setAdding(false);
    }
  }

  async function removeException(id: string) {
    try {
      const res = await fetch(`/api/instructors/me/unavailability/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("saveError"));
      setUnavailability((prev) => prev.filter((u) => u.id !== id));
      toast.success(t("exceptionRemoved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    }
  }

  if (profileLoading || loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isInstructor) {
    return (
      <div className="p-6">
        <StateCard
          tone="muted"
          icon={<AlertCircle />}
          title={t("forbiddenTitle")}
          description={t("forbiddenDesc")}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <StateCard
          tone="destructive"
          icon={<AlertCircle />}
          title={t("loadError")}
          description={error}
          action={
            <Button variant="outline" onClick={() => void load()}>
              {t("retry")}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">
          {t("weeklyTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("weeklyHint")}</p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => (
            <label
              key={d}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm"
            >
              <Checkbox
                checked={weekdays.includes(d)}
                onCheckedChange={() => toggleWeekday(d)}
              />
              {t(`weekday.${d}`)}
            </label>
          ))}
        </div>
        <Button
          type="button"
          disabled={savingWeekly}
          onClick={() => void saveWeekly()}
        >
          {savingWeekly ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          {t("saveWeekly")}
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">
          {t("exceptionsTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("exceptionsHint")}</p>

        <form
          onSubmit={(e) => void addException(e)}
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <div className="space-y-1.5 sm:w-40">
            <Label htmlFor="exc-date">{t("exceptionDate")}</Label>
            <Input
              id="exc-date"
              type="date"
              value={onDate}
              onChange={(e) => setOnDate(e.target.value)}
              required
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="exc-reason">{t("exceptionReason")}</Label>
            <Input
              id="exc-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("exceptionReasonPlaceholder")}
            />
          </div>
          <Button type="submit" disabled={adding || !onDate}>
            {adding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {t("addException")}
          </Button>
        </form>

        {unavailability.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noExceptions")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10">
            {unavailability.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {formatDate(u.on_date)}
                  </p>
                  {u.reason && (
                    <p className="truncate text-sm text-muted-foreground">
                      {u.reason}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label={t("removeException")}
                  onClick={() => void removeException(u.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
