"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import type {
  EnrollmentProcess,
  ProcessTemplateStageField,
  ProcessFieldValueRow,
} from "@/types";
import { isScalarFilled } from "@/lib/processes/field-types";
import { processContactLabel } from "@/lib/processes/contact-label";
import { cn } from "@/lib/utils";
import {
  ProcessFieldControl,
  type FieldDraftValue,
} from "@/components/processes/process-field-control";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type FieldRow = ProcessTemplateStageField & {
  value: ProcessFieldValueRow | null;
};

function isDraftIncomplete(
  field: ProcessTemplateStageField,
  draft: FieldDraftValue | undefined,
): boolean {
  if (!field.required) return false;
  if (!draft) return true;
  if (field.field_type === "file") {
    if (draft.clearFile) return true;
    if (draft.file) return false;
    return !draft.existing?.storage_path?.trim();
  }
  return !isScalarFilled(field.field_type, draft.value);
}

interface ProcessStageFieldsSheetProps {
  process: EnrollmentProcess | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canOperate: boolean;
  /** Aberto a partir do clique em Avançar com pendências. */
  fromAdvance?: boolean;
  /** Gate hard do template — esconde “avançar mesmo assim”. */
  blockAdvance?: boolean;
  onAdvanceAnyway?: () => void;
  onSaved: (summary: {
    processId: string;
    fields_total: number;
    fields_filled: number;
    fields_required_missing: number;
    required_missing: string[];
  }) => void;
}

export function ProcessStageFieldsSheet({
  process,
  open,
  onOpenChange,
  canOperate,
  fromAdvance = false,
  blockAdvance = false,
  onAdvanceAnyway,
  onSaved,
}: ProcessStageFieldsSheetProps) {
  const t = useTranslations("Processes.fields");
  const tList = useTranslations("Processes.list");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, FieldDraftValue>>({});
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const load = useCallback(async () => {
    if (!process) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/processes/${process.id}/fields`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t("loadFailed"));
      const rows = (json.fields ?? []) as FieldRow[];
      setFields(rows);
      const next: Record<string, FieldDraftValue> = {};
      for (const row of rows) {
        next[row.id] = {
          value: row.value?.value ?? (row.field_type === "checkbox" ? false : ""),
          file: null,
          clearFile: false,
          existing: row.value,
        };
      }
      setDrafts(next);
      setDirty(false);
      onSaved({
        processId: process.id,
        fields_total: json.fields_total ?? rows.length,
        fields_filled: json.fields_filled ?? 0,
        fields_required_missing: json.fields_required_missing ?? 0,
        required_missing: json.required_missing ?? [],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
    // onSaved é callback de status do board — não re-dispara o fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [process, t]);

  useEffect(() => {
    if (!open || !process) return;
    void load();
  }, [open, process, load]);

  function requestClose() {
    if (dirty && canOperate) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  }

  async function save() {
    if (!process || !canOperate) return;
    setSaving(true);
    try {
      const form = new FormData();
      const values: Array<{ field_id: string; value: unknown }> = [];
      for (const field of fields) {
        const draft = drafts[field.id];
        if (!draft) continue;
        if (field.field_type === "file") {
          if (draft.clearFile) form.set(`clear_file_${field.id}`, "1");
          if (draft.file) form.set(`file_${field.id}`, draft.file);
        } else {
          values.push({ field_id: field.id, value: draft.value });
        }
      }
      form.set("values", JSON.stringify(values));

      const res = await fetch(`/api/processes/${process.id}/fields`, {
        method: "PUT",
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t("saveFailed"));

      toast.success(t("saveSuccess"));
      setDirty(false);
      onSaved({
        processId: process.id,
        fields_total: json.fields_total ?? 0,
        fields_filled: json.fields_filled ?? 0,
        fields_required_missing: json.fields_required_missing ?? 0,
        required_missing: json.required_missing ?? [],
      });
      await load();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const contactLabel = process
    ? processContactLabel(process, tList("contactFallback"))
    : "";

  const pendingCount = useMemo(
    () =>
      fields.filter((field) => isDraftIncomplete(field, drafts[field.id]))
        .length,
    [fields, drafts],
  );

  const orderedFields = useMemo(() => {
    if (!fromAdvance) return fields;
    return [...fields].sort((a, b) => {
      const aPending = isDraftIncomplete(a, drafts[a.id]) ? 0 : 1;
      const bPending = isDraftIncomplete(b, drafts[b.id]) ? 0 : 1;
      return aPending - bPending || a.position - b.position;
    });
  }, [fields, drafts, fromAdvance]);

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
          else onOpenChange(true);
        }}
      >
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader className="shrink-0 border-b border-border pr-12">
            <SheetTitle className="truncate">
              {process?.current_stage?.name ?? tList("noStage")}
            </SheetTitle>
            <SheetDescription className="truncate">{contactLabel}</SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4">
            {fromAdvance && !loading && pendingCount > 0 ? (
              <p
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  blockAdvance
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted/60 text-muted-foreground",
                )}
              >
                {blockAdvance
                  ? t("advancePendingHard")
                  : t("advancePendingSoft")}
              </p>
            ) : null}

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("loading")}
              </div>
            ) : fields.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("emptyStage")}
              </p>
            ) : (
              orderedFields.map((field) => {
                const incomplete =
                  fromAdvance && isDraftIncomplete(field, drafts[field.id]);
                return (
                  <div
                    key={field.id}
                    className={cn(
                      incomplete &&
                        "rounded-lg border border-destructive/40 bg-destructive/5 p-3",
                    )}
                  >
                    <ProcessFieldControl
                      field={field}
                      draft={
                        drafts[field.id] ?? {
                          value: "",
                          file: null,
                          clearFile: false,
                          existing: null,
                        }
                      }
                      disabled={!canOperate || process?.status !== "active"}
                      onChange={(next) => {
                        setDrafts((prev) => ({ ...prev, [field.id]: next }));
                        setDirty(true);
                      }}
                    />
                  </div>
                );
              })
            )}
          </div>

          {canOperate && process?.status === "active" && fields.length > 0 ? (
            <SheetFooter className="shrink-0 border-t border-border">
              {fromAdvance && !blockAdvance && onAdvanceAnyway ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  className="mr-auto"
                  onClick={() => {
                    if (dirty) {
                      toast.message(t("saveBeforeAdvance"));
                      return;
                    }
                    onAdvanceAnyway();
                  }}
                >
                  {t("advanceAnyway")}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={requestClose}
              >
                {t("close")}
              </Button>
              <Button
                type="button"
                disabled={saving || !dirty}
                onClick={() => void save()}
              >
                {saving ? <Loader2 className="animate-spin" /> : null}
                {saving ? t("saving") : t("save")}
              </Button>
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("discardTitle")}</DialogTitle>
            <DialogDescription>{t("discardDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiscardOpen(false)}
            >
              {t("discardKeep")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDiscardOpen(false);
                setDirty(false);
                onOpenChange(false);
              }}
            >
              {t("discardConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
