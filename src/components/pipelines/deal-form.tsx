"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DEFAULT_CURRENCY } from "@/lib/currency";
import type {
  Contact,
  Conversation,
  Deal,
  DealStatus,
  PipelineStage,
  Profile,
} from "@/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  X,
  Trash2,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { usePipelineLabels } from "@/hooks/use-pipeline-labels";
import { cn } from "@/lib/utils";

const fieldLabelClass =
  "text-xs font-medium text-muted-foreground";
// `text-base md:text-sm`: abaixo de 16px o Safari no iOS aplica zoom
// automático ao focar o campo. Mantém 14px a partir de `md`.
const fieldControlClass =
  "h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-base text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary md:text-sm";
const fieldInputClass =
  "h-9 border-border bg-muted text-base text-foreground md:text-sm";
interface DealFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  pipelineId: string;
  stages: PipelineStage[];
  defaultStageId?: string;
  onSaved: () => void;
}

export function DealForm({
  open,
  onOpenChange,
  deal,
  pipelineId,
  stages,
  defaultStageId,
  onSaved,
}: DealFormProps) {
  const t = useTranslations("Pipelines.form");
  const { stageLabel } = usePipelineLabels();
  const supabase = createClient();
  const { accountId } = useAuth();

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [contactId, setContactId] = useState("");
  const [stageId, setStageId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [linkedConversation, setLinkedConversation] =
    useState<Conversation | null>(null);

  const [saving, setSaving] = useState(false);
  const [statusAction, setStatusAction] = useState<DealStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset the form fields every time the sheet opens or its input
  // props change. This is a legitimate prop-driven sync; the rule is
  // over-cautious here, hence the block-level disable.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (deal) {
      setTitle(deal.title);
      setValue(String(deal.value ?? ""));
      // contact_id is nullable when the contact has been deleted
      // (migration 004: ON DELETE SET NULL). "" means "no selection".
      setContactId(deal.contact_id ?? "");
      setStageId(deal.stage_id);
      setAssignedTo(deal.assigned_to ?? "");
      setExpectedCloseDate(deal.expected_close_date ?? "");
      setNotes(deal.notes ?? "");
    } else {
      setTitle("");
      setValue("");
      setContactId("");
      setStageId(defaultStageId || stages[0]?.id || "");
      setAssignedTo("");
      setExpectedCloseDate("");
      setNotes("");
    }
  }, [open, deal, defaultStageId, stages]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Load supporting data once the sheet is open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [c, p] = await Promise.all([
        supabase.from("contacts").select("*").order("name"),
        supabase.from("profiles").select("*").order("full_name"),
      ]);
      if (cancelled) return;
      setContacts((c.data ?? []) as Contact[]);
      setProfiles((p.data ?? []) as Profile[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  // Fetch linked conversation for the selected contact (newest open one).
  // Clearing on no-selection is sync with prop state; the populated
  // case runs setLinkedConversation inside the async fetch callback.
  useEffect(() => {
    if (!open || !contactId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinkedConversation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("contact_id", contactId)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setLinkedConversation((data as Conversation | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contactId, supabase]);

  async function handleSave() {
    if (!title.trim() || !contactId || !stageId) {
      toast.error(t("toastRequired"));
      return;
    }
    setSaving(true);

    const payload = {
      title: title.trim(),
      value: parseFloat(value) || 0,
      currency: DEFAULT_CURRENCY,
      contact_id: contactId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      assigned_to: assignedTo || null,
      notes: notes.trim() || null,
      expected_close_date: expectedCloseDate || null,
    };

    if (deal) {
      const { error } = await supabase
        .from("deals")
        .update(payload)
        .eq("id", deal.id);
      if (error) {
        toast.error(t("toastFailedSave"));
        setSaving(false);
        return;
      }
    } else {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        toast.error(t("toastNotSignedIn"));
        setSaving(false);
        return;
      }
      if (!accountId) {
        toast.error(t("toastNotLinked"));
        setSaving(false);
        return;
      }
      const { error } = await supabase
        .from("deals")
        .insert({ ...payload, user_id: user.id, account_id: accountId, status: "open" });
      if (error) {
        toast.error(t("toastFailedCreate"));
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    toast.success(deal ? t("toastUpdated") : t("toastCreated"));
    onOpenChange(false);
    onSaved();
  }

  async function handleStatusChange(status: DealStatus) {
    if (!deal) return;
    setStatusAction(status);
    const { error } = await supabase
      .from("deals")
      .update({ status })
      .eq("id", deal.id);
    setStatusAction(null);
    if (error) {
      toast.error(t("toastFailedStatus"));
      return;
    }
    toast.success(
      status === "won" ? t("toastMarkedWon") : status === "lost" ? t("toastMarkedLost") : t("toastReopened"),
    );
    onOpenChange(false);
    onSaved();
  }

  async function handleDelete() {
    if (!deal) return;
    setDeleting(true);
    const { error } = await supabase.from("deals").delete().eq("id", deal.id);
    setDeleting(false);
    if (error) {
      toast.error(t("toastFailedDelete"));
      return;
    }
    toast.success(t("toastDeleted"));
    setConfirmDelete(false);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-border bg-popover p-0 text-popover-foreground sm:max-w-xl"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="shrink-0 space-y-0 border-b border-border p-0 px-5 py-4 pr-12 text-left">
            <SheetTitle className="text-base font-semibold text-popover-foreground">
              {deal ? t("editDeal") : t("newDeal")}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {deal ? t("editDeal") : t("newDeal")}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-1.5">
              <Label className={fieldLabelClass}>{t("title")}</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("titlePlaceholder")}
                className={fieldInputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className={fieldLabelClass}>{t("contact")}</Label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className={fieldControlClass}
              >
                <option value="">{t("selectContact")}</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.phone}
                  </option>
                ))}
              </select>

              {linkedConversation && (
                <Link
                  href={`/inbox?c=${linkedConversation.id}`}
                  className="mt-0.5 inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-xs text-primary transition-colors hover:bg-muted"
                >
                  <MessageSquare className="size-3.5" />
                  {t("linkToConversation")}
                </Link>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className={fieldLabelClass}>{t("value")}</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                  R$
                </span>
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0"
                  className={cn(fieldInputClass, "pl-9")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label className={fieldLabelClass}>{t("stage")}</Label>
                <select
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                  className={fieldControlClass}
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {stageLabel(s.name)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label className={fieldLabelClass}>{t("assignedTo")}</Label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className={fieldControlClass}
                >
                  <option value="">{t("unassigned")}</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className={fieldLabelClass}>{t("expectedCloseDate")}</Label>
              <Input
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                className={fieldInputClass}
              />
            </div>

            {deal && (
              <div className="flex flex-col gap-1.5">
                <Label className={fieldLabelClass}>{t("status")}</Label>
                <div
                  role="group"
                  aria-label={t("status")}
                  className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted p-1"
                >
                  {(
                    [
                      {
                        value: "open" as const,
                        label: t("statusOpen"),
                        activeClass: "bg-background text-foreground shadow-sm",
                      },
                      {
                        value: "won" as const,
                        label: t("statusWon"),
                        Icon: Check,
                        activeClass: "bg-primary/15 text-primary shadow-sm",
                      },
                      {
                        value: "lost" as const,
                        label: t("statusLost"),
                        Icon: X,
                        activeClass: "bg-red-500/15 text-red-400 shadow-sm",
                      },
                    ] as const
                  ).map((opt) => {
                    const active = deal.status === opt.value;
                    const Icon = "Icon" in opt ? opt.Icon : null;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={!!statusAction}
                        aria-pressed={active}
                        onClick={() => {
                          if (active) return;
                          handleStatusChange(opt.value);
                        }}
                        className={cn(
                          "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
                          "disabled:pointer-events-none disabled:opacity-60",
                          active
                            ? opt.activeClass
                            : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                        )}
                      >
                        {statusAction === opt.value ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          Icon && <Icon className="size-3 shrink-0" />
                        )}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label className={fieldLabelClass}>{t("notes")}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("notesPlaceholder")}
                className="min-h-24 resize-none border-border bg-muted text-base text-foreground placeholder:text-muted-foreground md:text-sm"
              />
            </div>
          </div>

          <div className="shrink-0 space-y-3 border-t border-border px-5 py-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="flex-1 border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {t("cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !title.trim() || !contactId || !stageId}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                {saving
                  ? t("saving")
                  : deal
                    ? t("saveChanges")
                    : t("createDeal")}
              </Button>
            </div>

            {deal &&
              (confirmDelete ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
                  <span className="text-red-400">{t("deletePrompt")}</span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-md bg-red-600 px-2 py-1 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? t("deleting") : t("confirm")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-red-400"
                >
                  <Trash2 className="size-3.5" />
                  {t("deleteDeal")}
                </button>
              ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
