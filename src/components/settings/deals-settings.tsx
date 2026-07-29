"use client";

import { Coins } from "lucide-react";
import { useTranslations } from "next-intl";

import { DEFAULT_CURRENCY } from "@/lib/currency";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { SettingsPanelHead } from "./settings-panel-head";

/**
 * Negócios — o produto usa Real (BRL) como única moeda para novos
 * valores. Painel informativo (sem seletor): contas/negócios legados
 * com outra moeda gravada continuam exibidos nessa moeda.
 */
export function DealsSettings() {
  const t = useTranslations("Settings.deals");

  return (
    <section className="max-w-2xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title={t("title")}
        description={t("description")}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Coins className="size-4 text-primary" />
            {t("defaultCurrency")}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t("defaultCurrencyDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">
            {t("lockedValue", { code: DEFAULT_CURRENCY })}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("lockedHint")}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
