"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DocumentKind } from "@/lib/documents/types";

export type GenerateDocumentRequest = {
  kind: DocumentKind;
  contactId?: string;
  processId?: string;
  classId?: string;
  enrollmentId?: string;
  serviceOption?: string;
  serviceDescription?: string;
  trainingHoursLabel?: string;
  habilitation?: "arrais" | "motonauta";
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  summaryLines?: string[];
  gaps?: string[];
  /** Campos extras do requerimento */
  mode?: "simple" | "requerimento" | "atestado";
  onGenerate: (extra: {
    serviceOption?: string;
    serviceDescription?: string;
    trainingHoursLabel?: string;
  }) => Promise<void>;
};

const ARRAIS_SERVICES = [
  "EMISSÃO/RENOVAÇÃO",
  "RENOVAÇÃO COM AGREGAÇÃO DE MTA",
  "CONCESSÃO DE CHA POR EQUIVALÊNCIA",
];

const MOTO_SERVICES = [
  "EMISSÃO/RENOVAÇÃO/2ª VIA DE CHA NA CATEGORIA DE MTA",
  "EMISSÃO DE CHA-MTA-E",
  "RENOVAÇÃO COM AGREGAÇÃO DE CATEGORIA (MTA) NA CHA",
];

export function GenerateDocumentDialog({
  open,
  onOpenChange,
  title,
  description,
  summaryLines = [],
  gaps = [],
  mode = "simple",
  onGenerate,
}: Props) {
  const t = useTranslations("Documents");
  const [busy, setBusy] = useState(false);
  const [serviceOption, setServiceOption] = useState(ARRAIS_SERVICES[0]);
  const [serviceDescription, setServiceDescription] = useState("");
  const [trainingHoursLabel, setTrainingHoursLabel] = useState("");

  const blocked = gaps.length > 0;

  async function handleGenerate() {
    if (blocked) return;
    setBusy(true);
    try {
      await onGenerate({
        serviceOption: mode === "requerimento" ? serviceOption : undefined,
        serviceDescription:
          mode === "requerimento" ? serviceDescription : undefined,
        trainingHoursLabel:
          mode === "atestado" && trainingHoursLabel.trim()
            ? trainingHoursLabel.trim()
            : undefined,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("generateFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription>{t("disclaimer")}</DialogDescription>
          )}
        </DialogHeader>

        {summaryLines.length > 0 ? (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {summaryLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}

        {blocked ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <p className="font-medium">{t("gapsTitle")}</p>
            <ul className="mt-1 list-inside list-disc">
              {gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {mode === "requerimento" && !blocked ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("serviceOption")}</Label>
              <Select
                value={serviceOption}
                onValueChange={(v) => {
                  if (v) setServiceOption(v);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...ARRAIS_SERVICES, ...MOTO_SERVICES].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-svc-desc">{t("serviceDescription")}</Label>
              <Input
                id="doc-svc-desc"
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                placeholder={t("serviceDescriptionPlaceholder")}
              />
            </div>
          </div>
        ) : null}

        {mode === "atestado" && !blocked ? (
          <div className="space-y-1.5">
            <Label htmlFor="doc-hours">{t("trainingHours")}</Label>
            <Input
              id="doc-hours"
              value={trainingHoursLabel}
              onChange={(e) => setTrainingHoursLabel(e.target.value)}
              placeholder={t("trainingHoursPlaceholder")}
            />
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={busy || blocked}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("generatePdf")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export async function postGenerateDocument(
  body: GenerateDocumentRequest,
): Promise<{ id: string; file_name: string }> {
  const res = await fetch("/api/documents/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const gaps =
      Array.isArray(json.gaps) && json.gaps.length
        ? `: ${json.gaps.join(", ")}`
        : "";
    throw new Error((json.error || "Falha ao gerar") + gaps);
  }
  return {
    id: json.document.id as string,
    file_name: json.document.file_name as string,
  };
}

export async function downloadGeneratedDocument(id: string): Promise<void> {
  const res = await fetch(`/api/documents/${id}/download`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Falha ao baixar");
  window.open(json.url as string, "_blank", "noopener,noreferrer");
}
