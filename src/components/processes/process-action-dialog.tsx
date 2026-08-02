"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import type { EnrollmentProcess } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ProcessActionKind = "advance" | "complete" | "cancel";

/** Ações destrutivas / irreversíveis que ainda pedem confirmação. */
export type ProcessConfirmKind = "complete" | "cancel";

export interface ProcessAction {
  process: EnrollmentProcess;
  kind: ProcessConfirmKind;
}

interface ProcessActionDialogProps {
  action: ProcessAction | null;
  contactLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ProcessActionDialog({
  action,
  contactLabel,
  pending,
  onConfirm,
  onOpenChange,
}: ProcessActionDialogProps) {
  const t = useTranslations("Processes.confirm");

  const destructive = action?.kind === "cancel";

  const title = destructive ? t("cancelTitle") : t("completeTitle");
  const description = destructive
    ? t("cancelDescription", { contact: contactLabel })
    : t("completeDescription", { contact: contactLabel });
  const confirmLabel = destructive ? t("cancelConfirm") : t("completeConfirm");

  return (
    <Dialog open={action !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t("dismiss")}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
