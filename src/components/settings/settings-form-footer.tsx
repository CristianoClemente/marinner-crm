"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { settingsType } from "./settings-type";

/**
 * Rodapé de formulário persistido — espelha Marca da escola em Aparência:
 * dirty-state + Descartar + Salvar.
 */
export function SettingsFormFooter({
  formId,
  dirty,
  saving,
  onDiscard,
  saveLabel,
  savingLabel,
}: {
  formId: string;
  dirty: boolean;
  saving: boolean;
  onDiscard: () => void;
  saveLabel: string;
  savingLabel: string;
}) {
  const t = useTranslations("Settings.scope");

  return (
    <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20">
      <p
        aria-live="polite"
        className={cn(
          settingsType.meta,
          dirty ? "text-amber-700 dark:text-amber-300" : "invisible",
        )}
      >
        {t("unsaved")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={!dirty || saving}
          className="min-h-11 sm:min-h-8"
          onClick={onDiscard}
        >
          {t("discard")}
        </Button>
        <Button
          type="submit"
          form={formId}
          disabled={!dirty || saving}
          className="min-h-11 sm:min-h-8"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving ? savingLabel : saveLabel}
        </Button>
      </div>
    </CardFooter>
  );
}
