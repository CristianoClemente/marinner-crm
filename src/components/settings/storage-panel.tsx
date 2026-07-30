"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsPanelHead } from "@/components/settings/settings-panel-head";
import { formatBytesPt } from "@/lib/storage/chat-quota";

type PackageRow = {
  id: string;
  label: string;
  extra_bytes: number;
  starts_at: string;
  ends_at: string | null;
  status: string;
  notes: string | null;
};

type StoragePayload = {
  usedBytes: number;
  quotaBytes: number;
  retentionDays: number;
  baseQuotaBytes: number;
  usedLabel: string;
  quotaLabel: string;
  packages: PackageRow[];
};

export function StoragePanel() {
  const t = useTranslations("Settings.storage");
  const { canEditSettings } = useAuth();
  const [data, setData] = useState<StoragePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extraGb, setExtraGb] = useState("5");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/account/storage");
      const json = (await res.json().catch(() => ({}))) as StoragePayload & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || t("loadFailed"));
      }
      setData(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSettings) return;
    const gb = Number(extraGb);
    if (!Number.isFinite(gb) || gb <= 0) {
      toast.error(t("invalidGb"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/account/storage-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extra_gb: gb,
          label: label.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || t("addFailed"));
      }
      toast.success(t("addSuccess"));
      setLabel("");
      setNotes("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("addFailed"));
    } finally {
      setSaving(false);
    }
  };

  const onCancel = async (id: string) => {
    if (!canEditSettings) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/account/storage-packages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "canceled" }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || t("cancelFailed"));
      }
      toast.success(t("cancelSuccess"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("cancelFailed"));
    } finally {
      setSaving(false);
    }
  };

  const pct =
    data && data.quotaBytes > 0
      ? Math.min(100, Math.round((data.usedBytes / data.quotaBytes) * 100))
      : 0;

  return (
    <div className="space-y-6">
      <SettingsPanelHead
        title={t("title")}
        description={t("description")}
      />

      {loading || !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("loading")}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {t("usageTitle")}
              </p>
              <p className="text-sm text-muted-foreground">
                {data.usedLabel} / {data.quotaLabel} ({pct}%)
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("retentionHint", { days: data.retentionDays })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("baseQuotaHint", {
                base: formatBytesPt(data.baseQuotaBytes),
              })}
            </p>
            <p className="text-xs text-muted-foreground">{t("requestHint")}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              {t("packagesTitle")}
            </h3>
            {data.packages.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noPackages")}</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {data.packages.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {p.label}{" "}
                        <span className="font-normal text-muted-foreground">
                          ({formatBytesPt(p.extra_bytes)})
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.status === "active" ? t("statusActive") : t("statusCanceled")}
                        {p.notes ? ` · ${p.notes}` : ""}
                      </p>
                    </div>
                    {canEditSettings && p.status === "active" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => void onCancel(p.id)}
                      >
                        {t("cancelPackage")}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canEditSettings ? (
            <form
              onSubmit={onAddPackage}
              className="space-y-3 rounded-xl border border-border bg-card p-4"
            >
              <h3 className="text-sm font-medium text-foreground">
                {t("addPackageTitle")}
              </h3>
              <p className="text-xs text-muted-foreground">{t("addPackageHint")}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="extra-gb">{t("extraGb")}</Label>
                  <Input
                    id="extra-gb"
                    type="number"
                    min={1}
                    max={1024}
                    value={extraGb}
                    onChange={(e) => setExtraGb(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pkg-label">{t("label")}</Label>
                  <Input
                    id="pkg-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={t("labelPlaceholder")}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pkg-notes">{t("notes")}</Label>
                <Input
                  id="pkg-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("notesPlaceholder")}
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? t("saving") : t("addPackage")}
              </Button>
            </form>
          ) : null}
        </>
      )}
    </div>
  );
}
