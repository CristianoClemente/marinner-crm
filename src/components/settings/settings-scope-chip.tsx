"use client";

import { useTranslations } from "next-intl";

import { SettingsChip, type ChipVariant } from "./settings-chip";

export type SettingsScope = "account" | "personal" | "device";

const VARIANT: Record<SettingsScope, ChipVariant> = {
  account: "muted",
  personal: "muted",
  device: "ok",
};

/**
 * Chip de contrato de persistência — mesmo idioma visual da aba Aparência.
 * account/workspace/personal = precisa salvar; device = ao vivo.
 */
export function SettingsScopeChip({ scope }: { scope: SettingsScope }) {
  const t = useTranslations("Settings.scope");
  return <SettingsChip variant={VARIANT[scope]}>{t(scope)}</SettingsChip>;
}
