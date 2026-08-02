"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { useCan } from "@/hooks/use-can";
import type { EnrollmentProcess, ProcessTemplate } from "@/types";
import { Button } from "@/components/ui/button";
import { ProcessStatusBadge } from "@/components/processes/process-status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ContactProcessesPanelProps {
  contactId: string;
}

export function ContactProcessesPanel({ contactId }: ContactProcessesPanelProps) {
  const t = useTranslations("Contacts.detailView.processesTab");
  const canOperate = useCan("send-messages");
  const [processes, setProcesses] = useState<EnrollmentProcess[]>([]);
  const [templates, setTemplates] = useState<ProcessTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        fetch(`/api/processes?contact_id=${contactId}`),
        fetch("/api/process-templates?active=1"),
      ]);
      const pJson = await pRes.json().catch(() => ({}));
      const tJson = await tRes.json().catch(() => ({}));
      if (!pRes.ok) throw new Error(pJson.error || t("loadFailed"));
      setProcesses(pJson.processes ?? []);
      setTemplates(tJson.templates ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [contactId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!templateId && templates[0]) setTemplateId(templates[0].id);
  }, [templates, templateId]);

  async function openProcess() {
    if (!canOperate || !templateId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId,
          template_id: templateId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t("openFailed"));
      toast.success(t("openSuccess"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("openFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function action(
    id: string,
    kind: "advance" | "complete" | "cancel",
  ) {
    const res = await fetch(`/api/processes/${id}/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error || t("actionFailed"));
      return;
    }
    toast.success(t("actionSuccess"));
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canOperate ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {t("openLabel")}
            </p>
            <Select
              value={templateId}
              onValueChange={(v) => {
                if (v) setTemplateId(v);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("templatePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={saving || !templateId || templates.length === 0}
            onClick={() => void openProcess()}
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            {t("open")}
          </Button>
        </div>
      ) : null}

      {processes.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {processes.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-border bg-muted/40 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {p.template?.name ?? p.template_id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.current_stage?.name ?? "—"}
                  </p>
                </div>
                <ProcessStatusBadge status={p.status} />
              </div>
              {canOperate && p.status === "active" ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void action(p.id, "advance")}
                  >
                    {t("advance")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void action(p.id, "complete")}
                  >
                    {t("complete")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void action(p.id, "cancel")}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
