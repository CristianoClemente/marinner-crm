"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronRight, ListChecks, Plus, Settings2 } from "lucide-react";

import { useCan } from "@/hooks/use-can";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { sortStages } from "@/lib/processes/advance";
import { processContactLabel } from "@/lib/processes/contact-label";
import type { EnrollmentProcess, ProcessTemplate } from "@/types";
import { ContactSearchField } from "@/components/contacts/contact-search-field";
import { ContactDetailView } from "@/components/contacts/contact-detail-view";
import { ProcessBoard } from "@/components/processes/process-board";
import {
  ProcessActionDialog,
  type ProcessAction,
  type ProcessActionKind,
} from "@/components/processes/process-action-dialog";
import { ProcessDetailSheet } from "@/components/processes/process-detail-sheet";
import { ProcessStageFieldsSheet } from "@/components/processes/process-stage-fields-sheet";
import { ProcessStatusBadge } from "@/components/processes/process-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { StateCard } from "@/components/ui/state-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function ProcessesPage() {
  const t = useTranslations("Processes.list");
  const canOperate = useCan("send-messages");
  const canManageTemplates = useCan("edit-settings");

  const [processes, setProcesses] = useState<EnrollmentProcess[]>([]);
  const [templates, setTemplates] = useState<ProcessTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [status, setStatus] = useState("active");
  const [templateId, setTemplateId] = useState("");
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState("");
  const [openTemplateId, setOpenTemplateId] = useState("");
  const [contactActive, setContactActive] = useState<EnrollmentProcess[]>([]);
  const [saving, setSaving] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [fieldsProcess, setFieldsProcess] = useState<EnrollmentProcess | null>(
    null,
  );
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [fieldsFromAdvance, setFieldsFromAdvance] = useState(false);
  const [pendingByProcessId, setPendingByProcessId] = useState<
    Record<string, number>
  >({});
  const [contactDetailId, setContactDetailId] = useState<string | null>(null);
  const [contactDetailOpen, setContactDetailOpen] = useState(false);
  const [action, setAction] = useState<ProcessAction | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/process-templates");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t("loadFailed"));
      const list: ProcessTemplate[] = json.templates ?? [];
      setTemplates(list);
      // O quadro só faz sentido dentro de um fluxo: entra no primeiro
      // template ativo em vez de misturar habilitação e despachante.
      const first = list.find((tpl) => tpl.active && (tpl.stages?.length ?? 0) > 0);
      setTemplateId((prev) => prev || first?.id || "all");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
      setTemplateId((prev) => prev || "all");
    } finally {
      setTemplatesLoading(false);
    }
  }, [t]);

  const loadProcesses = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!templateId) return;
      if (!options?.silent) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (status !== "all") params.set("status", status);
        if (templateId !== "all") params.set("template_id", templateId);
        const res = await fetch(`/api/processes?${params}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || t("loadFailed"));
        setProcesses(json.processes ?? []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("loadFailed"));
      } finally {
        setLoading(false);
      }
    },
    [status, templateId, t],
  );

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    void loadProcesses();
  }, [loadProcesses]);

  const activeTemplates = useMemo(
    () => templates.filter((tpl) => tpl.active),
    [templates],
  );

  useEffect(() => {
    if (!openTemplateId && activeTemplates[0]) {
      setOpenTemplateId(
        templateId !== "all" && activeTemplates.some((tpl) => tpl.id === templateId)
          ? templateId
          : activeTemplates[0].id,
      );
    }
  }, [activeTemplates, openTemplateId, templateId]);

  // Avisa quando o contato já tem processo aberto — dois processos do mesmo
  // template no mesmo aluno costumam ser duplicidade, não paralelismo.
  useEffect(() => {
    if (!open || !contactId) {
      setContactActive([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/processes?contact_id=${contactId}&status=active`,
      );
      const json = await res.json().catch(() => ({}));
      if (cancelled || !res.ok) return;
      setContactActive(json.processes ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contactId]);

  const selectedTemplate = useMemo(
    () => templates.find((tpl) => tpl.id === templateId) ?? null,
    [templates, templateId],
  );
  const boardStages = useMemo(
    () => sortStages(selectedTemplate?.stages ?? []),
    [selectedTemplate],
  );
  const boardMode = status === "active" && selectedTemplate !== null;

  const duplicateTemplate = contactActive.some(
    (p) => p.template_id === openTemplateId,
  );

  async function createProcess() {
    if (!canOperate) return;
    if (!contactId.trim() || !openTemplateId) {
      toast.error(t("requiredFields"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId.trim(),
          template_id: openTemplateId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t("createFailed"));
      toast.success(t("createSuccess"));
      setOpen(false);
      setContactId("");
      // Cai no quadro do template recém-aberto para o processo ficar visível.
      const sameView = status === "active" && templateId === openTemplateId;
      if (sameView) {
        await loadProcesses({ silent: true });
      } else {
        setStatus("active");
        setTemplateId(openTemplateId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("createFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(
    process: EnrollmentProcess,
    kind: ProcessActionKind,
  ) {
    if (actionPending) return;
    setActionPending(true);
    try {
      const res = await fetch(`/api/processes/${process.id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (
          kind === "advance" &&
          res.status === 409 &&
          Array.isArray(json.missing)
        ) {
          setAction(null);
          setFieldsFromAdvance(true);
          setFieldsProcess(process);
          setFieldsOpen(true);
          setPendingByProcessId((prev) => ({
            ...prev,
            [process.id]: (json.missing as string[]).length,
          }));
          toast.message(t("advanceNeedsFields"));
          return;
        }
        throw new Error(
          json.error ||
            (kind === "advance"
              ? t("advanceFailed")
              : kind === "complete"
                ? t("completeFailed")
                : t("cancelFailed")),
        );
      }
      toast.success(
        kind === "cancel"
          ? t("cancelSuccess")
          : json.process?.status === "completed"
            ? t("completeSuccess")
            : t("advanceSuccess"),
      );
      setAction(null);
      setDataVersion((v) => v + 1);
      await loadProcesses({ silent: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("advanceFailed"));
    } finally {
      setActionPending(false);
    }
  }

  async function moveToStage(process: EnrollmentProcess, stageId: string) {
    try {
      const res = await fetch(`/api/processes/${process.id}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_stage_id: stageId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && Array.isArray(json.missing)) {
          setFieldsFromAdvance(true);
          setFieldsProcess(process);
          setFieldsOpen(true);
          toast.message(t("advanceNeedsFields"));
          return;
        }
        throw new Error(json.error || t("moveFailed"));
      }
      setDataVersion((v) => v + 1);
      await loadProcesses({ silent: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("moveFailed"));
    }
  }

  function openDetail(process: EnrollmentProcess) {
    setDetailId(process.id);
    setDetailOpen(true);
  }

  async function openCard(process: EnrollmentProcess) {
    try {
      const res = await fetch(`/api/processes/${process.id}/fields`);
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setPendingByProcessId((prev) => ({
          ...prev,
          [process.id]: json.fields_required_missing ?? 0,
        }));
        if ((json.fields_total ?? 0) > 0) {
          setFieldsFromAdvance(false);
          setFieldsProcess(process);
          setFieldsOpen(true);
          return;
        }
      }
    } catch {
      // cai no detalhe
    }
    openDetail(process);
  }

  function openContact(id: string) {
    setDetailOpen(false);
    setFieldsOpen(false);
    setContactDetailId(id);
    setContactDetailOpen(true);
  }

  async function requestAction(
    process: EnrollmentProcess,
    kind: ProcessActionKind,
  ) {
    if (kind === "advance") {
      try {
        const res = await fetch(`/api/processes/${process.id}/fields`);
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          const missing = (json.required_missing ?? []) as string[];
          const missingCount = json.fields_required_missing ?? missing.length;
          setPendingByProcessId((prev) => ({
            ...prev,
            [process.id]: missingCount,
          }));
          if (missingCount > 0) {
            setAction(null);
            setFieldsFromAdvance(true);
            setFieldsProcess(process);
            setFieldsOpen(true);
            return;
          }
        }
      } catch {
        // sem campos carregados — tenta avançar; 409 abre o slideover
      }
      await runAction(process, "advance");
      return;
    }
    setAction({ process, kind });
  }

  const busy = templatesLoading || loading;

  return (
    <div
      className={cn(
        boardMode && !busy
          ? "-m-4 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden sm:-m-6"
          : "space-y-5",
      )}
    >
      <div
        className={cn(
          boardMode && !busy
            ? "shrink-0 space-y-3 px-4 pt-4 sm:px-6 sm:pt-6"
            : "space-y-3",
        )}
      >
        <div className="flex items-start justify-between gap-3 sm:items-center">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("description")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManageTemplates ? (
              <Link
                href="/process-templates"
                aria-label={t("manageTemplates")}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "relative size-9 p-0 after:absolute after:-inset-1 sm:h-8 sm:w-auto sm:px-2.5 sm:after:hidden",
                )}
              >
                <Settings2 className="size-4" />
                <span className="hidden sm:inline">{t("manageTemplates")}</span>
              </Link>
            ) : null}
            {canOperate ? (
              <Button
                type="button"
                aria-label={t("openProcess")}
                disabled={activeTemplates.length === 0}
                className="relative size-9 p-0 after:absolute after:-inset-1 sm:h-8 sm:w-auto sm:px-2.5 sm:after:hidden"
                onClick={() => {
                  setContactId("");
                  setOpen(true);
                }}
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">{t("openProcess")}</span>
              </Button>
            ) : null}
          </div>
        </div>

        {templates.length > 0 ? (
          <div className="flex items-center gap-2">
            <Select
              value={templateId}
              onValueChange={(v) => {
                if (v) setTemplateId(v);
              }}
            >
              <SelectTrigger
                aria-label={t("filterTemplate")}
                className="h-9 min-w-0 flex-1 sm:h-8 sm:w-56 sm:flex-none"
              >
                <SelectValue placeholder={t("allTemplates")}>
                  {templateId === "all"
                    ? t("allTemplates")
                    : (selectedTemplate?.name ?? t("allTemplates"))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </SelectItem>
                ))}
                <SelectItem value="all">{t("allTemplates")}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => {
                if (v) setStatus(v);
              }}
            >
              <SelectTrigger
                aria-label={t("filterStatus")}
                className="h-9 w-36 shrink-0 sm:h-8"
              >
                <SelectValue>
                  {status === "active"
                    ? t("statusActive")
                    : status === "completed"
                      ? t("statusCompleted")
                      : status === "canceled"
                        ? t("statusCanceled")
                        : t("statusAll")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("statusActive")}</SelectItem>
                <SelectItem value="completed">{t("statusCompleted")}</SelectItem>
                <SelectItem value="canceled">{t("statusCanceled")}</SelectItem>
                <SelectItem value="all">{t("statusAll")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {busy ? (
        <BoardSkeleton />
      ) : templates.length === 0 ? (
        <StateCard
          tone="primary"
          icon={<ListChecks />}
          title={t("noTemplatesTitle")}
          description={
            canManageTemplates
              ? t("noTemplatesDescription")
              : t("noTemplatesViewer")
          }
          action={
            canManageTemplates ? (
              <Link
                href="/process-templates"
                className={buttonVariants({ variant: "default" })}
              >
                <Plus className="size-4" />
                {t("noTemplatesAction")}
              </Link>
            ) : undefined
          }
        />
      ) : processes.length === 0 ? (
        <StateCard
          tone={status === "active" ? "primary" : "muted"}
          icon={<ListChecks />}
          title={status === "active" ? t("emptyTitle") : t("emptyFilteredTitle")}
          description={
            status === "active"
              ? selectedTemplate
                ? t("emptyDescriptionTemplate", { template: selectedTemplate.name })
                : t("emptyDescription")
              : t("emptyFilteredDescription")
          }
          action={
            status !== "active" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStatus("active")}
              >
                {t("emptyFilteredAction")}
              </Button>
            ) : canOperate ? (
              <Button type="button" onClick={() => setOpen(true)}>
                <Plus className="size-4" />
                {t("openProcess")}
              </Button>
            ) : undefined
          }
        />
      ) : boardMode && boardStages.length === 0 ? (
        <StateCard
          tone="muted"
          icon={<ListChecks />}
          title={t("noStagesTitle")}
          description={t("noStagesDescription")}
          action={
            canManageTemplates ? (
              <Link
                href="/process-templates"
                className={buttonVariants({ variant: "outline" })}
              >
                <Settings2 className="size-4" />
                {t("manageTemplates")}
              </Link>
            ) : undefined
          }
        />
      ) : boardMode ? (
        <div className="min-h-0 flex-1 px-4 pt-1 pb-4 sm:px-6 sm:pb-6">
          <ProcessBoard
            stages={boardStages}
            processes={processes}
            canOperate={canOperate}
            advanceMode={selectedTemplate?.advance_mode ?? "sequential"}
            pendingByProcessId={pendingByProcessId}
            onOpen={(p) => void openCard(p)}
            onViewContact={openContact}
            onAction={(p, k) => void requestAction(p, k)}
            onMoveToStage={(p, stageId) => void moveToStage(p, stageId)}
          />
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {processes.map((p) => {
            const stages = sortStages(
              templates.find((tpl) => tpl.id === p.template_id)?.stages ?? [],
            );
            const index = p.current_stage_id
              ? stages.findIndex((s) => s.id === p.current_stage_id)
              : -1;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => openDetail(p)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {processContactLabel(p, t("contactFallback"))}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.template?.name}
                      {" · "}
                      {p.current_stage?.name ?? t("noStage")}
                      {index >= 0 && stages.length > 0
                        ? ` · ${t("stageProgress", { current: index + 1, total: stages.length })}`
                        : ""}
                      {` · ${t("openedAt", { date: formatDate(p.opened_at) })}`}
                    </p>
                  </div>
                  <ProcessStatusBadge status={p.status} />
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("openTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {open ? (
              <ContactSearchField
                key="open-contact-search"
                contactId={contactId}
                onContactIdChange={setContactId}
              />
            ) : null}
            <div className="space-y-1.5">
              <Label>{t("template")}</Label>
              <Select
                value={openTemplateId}
                onValueChange={(v) => {
                  if (v) setOpenTemplateId(v);
                }}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder={t("template")}>
                    {activeTemplates.find((tpl) => tpl.id === openTemplateId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activeTemplates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {contactActive.length > 0 ? (
              <p
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  duplicateTemplate
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted/50 text-muted-foreground",
                )}
              >
                {duplicateTemplate
                  ? t("duplicateWarning")
                  : t("parallelNotice", {
                      list: contactActive
                        .map((p) => p.template?.name ?? "—")
                        .join(", "),
                    })}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              disabled={saving || !contactId || !openTemplateId}
              onClick={() => void createProcess()}
            >
              {saving ? t("saving") : t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProcessActionDialog
        action={action}
        contactLabel={
          action ? processContactLabel(action.process, t("contactFallback")) : ""
        }
        pending={actionPending}
        onConfirm={() => {
          if (!action) return;
          void runAction(action.process, action.kind);
        }}
        onOpenChange={(next) => {
          if (!next && !actionPending) setAction(null);
        }}
      />

      <ProcessStageFieldsSheet
        process={fieldsProcess}
        open={fieldsOpen}
        onOpenChange={(next) => {
          setFieldsOpen(next);
          if (!next) setFieldsFromAdvance(false);
        }}
        canOperate={canOperate}
        fromAdvance={fieldsFromAdvance}
        blockAdvance={Boolean(
          fieldsProcess &&
            templates.find((tpl) => tpl.id === fieldsProcess.template_id)
              ?.block_advance_if_incomplete,
        )}
        onAdvanceAnyway={
          fieldsProcess && fieldsFromAdvance
            ? () => {
                const process = fieldsProcess;
                setFieldsOpen(false);
                setFieldsFromAdvance(false);
                void runAction(process, "advance");
              }
            : undefined
        }
        onSaved={(summary) => {
          setPendingByProcessId((prev) => ({
            ...prev,
            [summary.processId]: summary.fields_required_missing,
          }));
        }}
      />

      <ProcessDetailSheet
        processId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canOperate={canOperate}
        refreshToken={dataVersion}
        onAction={(p, k) => void requestAction(p, k)}
        onViewContact={openContact}
        onFillFields={(p) => {
          setDetailOpen(false);
          setFieldsFromAdvance(false);
          setFieldsProcess(p);
          setFieldsOpen(true);
        }}
      />

      <ContactDetailView
        open={contactDetailOpen}
        onOpenChange={setContactDetailOpen}
        contactId={contactDetailId}
        onUpdated={() => void loadProcesses({ silent: true })}
      />
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="min-w-65 flex-1 space-y-2 rounded-lg border border-border bg-muted/40 p-3"
        >
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-16 animate-pulse rounded-lg bg-card/60" />
          <div className="h-16 animate-pulse rounded-lg bg-card/60" />
        </div>
      ))}
    </div>
  );
}
