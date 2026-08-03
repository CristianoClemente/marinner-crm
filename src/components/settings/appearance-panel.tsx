"use client";

import { Check, Monitor, Palette, SunMoon } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import { DEFAULT_THEME, MODES, THEMES, type Mode, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { BrandingPanel } from "./branding-panel";
import { SettingsScopeChip } from "./settings-scope-chip";
import { SettingsPanelHead } from "./settings-panel-head";
import { settingsType } from "./settings-type";

/**
 * Aparência + marca da escola.
 *
 * Dois contratos de persistência, visualmente separados:
 * 1. Marca (conta) — Card + Salvar → banco
 * 2. Preferências do dispositivo — ao vivo → localStorage
 */
export function AppearancePanel() {
  const t = useTranslations("Settings.appearance");

  return (
    <section className="max-w-3xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead title={t("title")} description={t("description")} />

      <div className="space-y-10">
        <BrandingPanel />

        <DevicePreferences />
      </div>
    </section>
  );
}

/** Zona B — tema ao vivo; sem Card de formulário e sem CTA Salvar. */
function DevicePreferences() {
  const { theme, setTheme, mode, setMode } = useTheme();
  const t = useTranslations("Settings.appearance");
  const activeTheme = THEMES.find((item) => item.id === theme) ?? THEMES[0];

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-t border-border pt-8">
        <div className="min-w-0">
          <h3 className={cn("flex items-center gap-2", settingsType.sectionTitle)}>
            <Monitor className="size-4 text-muted-foreground" aria-hidden />
            {t("deviceTitle")}
          </h3>
          <p className={cn("mt-1 max-w-[56ch]", settingsType.body)}>
            {t("deviceHint")}
          </p>
        </div>
        <SettingsScopeChip scope="device" />
      </div>

      <div className="space-y-6 rounded-xl bg-muted/30 p-4 ring-1 ring-foreground/10 sm:p-5">
        <div className="space-y-3">
          <SectionHead icon={<SunMoon className="size-4" />} title={t("mode")}>
            {t("modeHint")}
          </SectionHead>

          <div
            role="radiogroup"
            aria-label={t("mode")}
            className="grid max-w-md grid-cols-2 gap-3"
          >
            {MODES.map((m) => (
              <ModeCard
                key={m}
                mode={m}
                isActive={m === mode}
                onPick={() => setMode(m)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t border-border/60 pt-5">
          <SectionHead icon={<Palette className="size-4" />} title={t("accentColor")}>
            {t("accentHint")}
          </SectionHead>

          <div
            role="radiogroup"
            aria-label={t("accentColor")}
            className="flex flex-wrap gap-3"
          >
            {THEMES.map((item) => (
              <SwatchButton
                key={item.id}
                id={item.id}
                name={item.name}
                swatch={item.swatch}
                isDefault={item.id === DEFAULT_THEME}
                isActive={item.id === theme}
                onPick={() => setTheme(item.id)}
              />
            ))}
          </div>

          <p aria-live="polite" className={settingsType.meta}>
            {activeTheme.id === DEFAULT_THEME
              ? t("accentRecommended")
              : t("accentSelected", { name: activeTheme.name })}
          </p>
        </div>
      </div>
    </section>
  );
}

function SectionHead({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className={cn("flex items-center gap-2 text-sm font-medium text-foreground")}>
        <span className="text-muted-foreground" aria-hidden>
          {icon}
        </span>
        {title}
      </h4>
      <p className={cn("mt-1", settingsType.meta)}>{children}</p>
    </div>
  );
}

/**
 * Superfícies fixas por modo. Cor crua é intencional aqui: o cartão
 * precisa mostrar o modo *oposto* ao que está ativo, então não pode
 * herdar os tokens de `html[data-mode]`. Valores espelham globals.css.
 */
const MODE_SURFACES: Record<Mode, { bg: string; card: string; line: string }> = {
  light: {
    bg: "oklch(0.99 0.002 260)",
    card: "oklch(1 0 0)",
    line: "oklch(0.9 0.004 260)",
  },
  dark: {
    bg: "oklch(0.13 0.01 260)",
    card: "oklch(0.18 0.01 260)",
    line: "oklch(0.3 0.01 260)",
  },
};

function ModeCard({
  mode,
  isActive,
  onPick,
}: {
  mode: Mode;
  isActive: boolean;
  onPick: () => void;
}) {
  const t = useTranslations("Settings.appearance");
  const label = mode === "light" ? t("modeLight") : t("modeDark");
  const surfaces = MODE_SURFACES[mode];

  return (
    <button
      type="button"
      role="radio"
      onClick={onPick}
      aria-checked={isActive}
      aria-label={t("useMode", { mode: label })}
      className={cn(
        "group overflow-hidden rounded-xl border bg-card text-left transition-colors",
        isActive
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/40",
      )}
    >
      <span
        aria-hidden
        className="flex h-16 items-stretch gap-1.5 p-2"
        style={{ background: surfaces.bg }}
      >
        <span
          className="w-1/4 rounded-sm"
          style={{ background: surfaces.card }}
        />
        <span
          className="flex flex-1 flex-col justify-center gap-1.5 rounded-sm p-2"
          style={{ background: surfaces.card }}
        >
          <span
            className="block h-1.5 w-2/3 rounded-full"
            style={{ background: "var(--primary)" }}
          />
          <span
            className="block h-1.5 w-full rounded-full"
            style={{ background: surfaces.line }}
          />
          <span
            className="block h-1.5 w-4/5 rounded-full"
            style={{ background: surfaces.line }}
          />
        </span>
      </span>

      <span className="flex min-h-11 items-center justify-between gap-2 border-t border-border px-3 py-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {isActive ? (
          <span
            className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
            aria-hidden
          >
            <Check className="size-3" />
          </span>
        ) : (
          <span
            className="size-5 rounded-full border border-border"
            aria-hidden
          />
        )}
      </span>
    </button>
  );
}

function SwatchButton({
  id,
  name,
  swatch,
  isDefault,
  isActive,
  onPick,
}: {
  id: ThemeId;
  name: string;
  swatch: string;
  isDefault: boolean;
  isActive: boolean;
  onPick: () => void;
}) {
  const t = useTranslations("Settings.appearance");
  return (
    <button
      type="button"
      role="radio"
      onClick={onPick}
      aria-checked={isActive}
      aria-label={
        isDefault
          ? `${t("useTheme", { name })} — ${t("accentRecommended")}`
          : t("useTheme", { name })
      }
      title={isDefault ? `${name} · ${t("accentRecommended")}` : name}
      className={cn(
        "relative flex size-11 items-center justify-center rounded-full transition-transform sm:size-10",
        "ring-offset-2 ring-offset-background hover:scale-105",
        isActive ? "ring-2 ring-foreground/80" : "ring-1 ring-border",
        isDefault && !isActive && "ring-2 ring-primary/50",
      )}
      style={{ background: swatch }}
    >
      {isActive && (
        <Check
          className="size-4 drop-shadow-sm"
          style={{ color: "oklch(0.985 0 0)" }}
          aria-hidden
        />
      )}
      <span className="sr-only">{id}</span>
    </button>
  );
}
