"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, ChevronRight, UserRound, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { processContactLabel } from "@/lib/processes/contact-label";
import type {
  EnrollmentProcess,
  ProcessStageHistory,
  ProcessTemplateStage,
} from "@/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ProcessStatusBadge } from "./process-status-badge";
import type { ProcessActionKind } from "./process-action-dialog";

interface ProcessDetailSheetProps {
  processId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canOperate: boolean;
  /** Incrementado a cada ação concluída para recarregar o detalhe. */
  refreshToken: number;
  onAction: (process: EnrollmentProcess, kind: ProcessActionKind) => void;
  onViewContact: (contactId: string) => void;
  onFillFields?: (process: EnrollmentProcess) => void;
}

export function ProcessDetailSheet({
  processId,
  open,
  onOpenChange,
  canOperate,
  refreshToken,
  onAction,
  onViewContact,
  onFillFields,
}: ProcessDetailSheetProps) {
  const t = useTranslations("Processes.detail");
  const tList = useTranslations("Processes.list");
  const [process, setProcess] = useState<EnrollmentProcess | null>(null);
  const [stages, setStages] = useState<ProcessTemplateStage[]>([]);
  const [history, setHistory] = useState<ProcessStageHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!processId) return;
    setLoading(true);
    // Evita mostrar o processo anterior enquanto o novo carrega.
    setProcess((prev) => (prev?.id === processId ? prev : null));
    try {
      const res = await fetch(`/api/processes/${processId}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t("loadFailed"));
      setProcess(json.process ?? null);
      setStages(json.stages ?? []);
      setHistory(json.history ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [processId, t]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load, refreshToken]);

  const stageIndex = process?.current_stage_id
    ? stages.findIndex((s) => s.id === process.current_stage_id)
    : -1;
  const contactLabel = process
    ? processContactLabel(process, tList("contactFallback"))
    : "";

  function stageName(id: string | null): string | null {
    if (!id) return null;
    return stages.find((s) => s.id === id)?.name ?? null;
  }

  function historyTitle(entry: ProcessStageHistory): string {
    if (!entry.from_stage_id) {
      return t("historyOpened", {
        stage: stageName(entry.to_stage_id) ?? tList("noStage"),
      });
    }
    if (!entry.to_stage_id) return t("historyCompleted");
    if (entry.from_stage_id === entry.to_stage_id) return t("historyCanceled");
    return t("historyMoved", {
      stage: stageName(entry.to_stage_id) ?? tList("noStage"),
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-border pr-12">
          <div className="flex items-center gap-2">
            <SheetTitle className="min-w-0 truncate">
              {loading && !process ? t("loading") : contactLabel}
            </SheetTitle>
            {process ? <ProcessStatusBadge status={process.status} /> : null}
          </div>
          <SheetDescription className="truncate">
            {process?.template?.name ?? ""}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-4">
          {process ? (
            <>
              <section className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-foreground">
                    {process.current_stage?.name ?? tList("noStage")}
                  </p>
                  {stages.length > 0 && stageIndex >= 0 ? (
                    <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {tList("stageProgress", {
                        current: stageIndex + 1,
                        total: stages.length,
                      })}
                    </p>
                  ) : null}
                </div>
                {stages.length > 0 ? (
                  <div aria-hidden className="flex gap-1">
                    {stages.map((stage, index) => (
                      <span
                        key={stage.id}
                        className={cn(
                          "h-1 flex-1 rounded-full",
                          process.status === "completed" ||
                            (stageIndex >= 0 && index <= stageIndex)
                            ? "bg-primary"
                            : "bg-muted",
                        )}
                      />
                    ))}
                  </div>
                ) : null}
              </section>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Field label={t("phone")} value={process.contact?.phone} />
                <Field label={t("cpf")} value={process.contact?.cpf} />
                <Field
                  label={t("openedAt")}
                  value={formatDateTime(process.opened_at)}
                />
                {process.completed_at ? (
                  <Field
                    label={t("completedAt")}
                    value={formatDateTime(process.completed_at)}
                  />
                ) : null}
                {process.canceled_at ? (
                  <Field
                    label={t("canceledAt")}
                    value={formatDateTime(process.canceled_at)}
                  />
                ) : null}
              </dl>

              {canOperate && process.status === "active" ? (
                <div className="flex flex-wrap gap-2">
                  {onFillFields ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onFillFields(process)}
                    >
                      {t("fillStage")}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    onClick={() => onAction(process, "advance")}
                  >
                    {tList("advance")}
                    <ChevronRight />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onAction(process, "complete")}
                  >
                    <Check />
                    {tList("complete")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onAction(process, "cancel")}
                  >
                    <X />
                    {tList("cancelProcess")}
                  </Button>
                </div>
              ) : null}

              <section className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">
                  {t("history")}
                </h3>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("historyEmpty")}
                  </p>
                ) : (
                  <ol className="space-y-3 border-l border-border pl-4">
                    {history.map((entry, index) => (
                      <li key={entry.id} className="relative">
                        <span
                          aria-hidden
                          className={cn(
                            "absolute top-1.5 -left-[1.3125rem] size-1.5 rounded-full",
                            index === 0 ? "bg-primary" : "bg-border",
                          )}
                        />
                        <p className="text-sm text-foreground">
                          {historyTitle(entry)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(entry.created_at)}
                        </p>
                        {entry.note ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {entry.note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          ) : loading ? (
            <div className="space-y-3 pt-2">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-1 w-full animate-pulse rounded bg-muted" />
              <div className="h-16 w-full animate-pulse rounded-lg bg-muted/60" />
              <div className="h-24 w-full animate-pulse rounded-lg bg-muted/60" />
            </div>
          ) : null}
        </div>

        {process ? (
          <SheetFooter className="shrink-0 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onViewContact(process.contact_id)}
            >
              <UserRound />
              {tList("viewContact")}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm text-foreground">{value?.trim() || "—"}</dd>
    </div>
  );
}
