"use client";

import { Check, Palette, SunMoon } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import { MODES, THEMES, type Mode, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { BrandingPanel } from "./branding-panel";
import { SettingsPanelHead } from "./settings-panel-head";

/**
 * Aparência + marca da escola.
 *
 * 1. Marca (conta): nome, logo, slug — admin+, persistido no banco.
 * 2. Tema do dispositivo: modo + cor de destaque — localStorage.
 */
export function AppearancePanel() {
  const { theme, setTheme, mode, setMode } = useTheme();
  const t = useTranslations("Settings.appearance");

  const activeTheme = THEMES.find((item) => item.id === theme) ?? THEMES[0];

  return (
    <section className="max-w-3xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead title={t("title")} description={t("description")} />

      <div className="space-y-8">
        <BrandingPanel />

        <section className="space-y-3">
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
        </section>

        <section className="space-y-3">
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
                isActive={item.id === theme}
                onPick={() => setTheme(item.id)}
              />
            ))}
          </div>

          <div
            aria-live="polite"
            className="rounded-lg border border-border bg-card px-4 py-3"
          >
            <div className="text-sm font-semibold text-foreground">
              {activeTheme.name}
            </div>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              {activeTheme.tagline}
            </p>
          </div>
        </section>
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
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-muted-foreground" aria-hidden>
          {icon}
        </span>
        {title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
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
      {/* Miniatura da UI no modo correspondente. */}
      <span
        aria-hidden
        className="flex h-16 items-stretch gap-1.5 p-2"
        style={{ background: surfaces.bg }}
      >
        <span
          className="w-1/4 rounded-sm"
          style={{ background: surfaces.card }}
        />
        <span className="flex flex-1 flex-col justify-center gap-1.5 rounded-sm p-2"
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
  isActive,
  onPick,
}: {
  id: ThemeId;
  name: string;
  swatch: string;
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
      aria-label={t("useTheme", { name })}
      title={name}
      className={cn(
        "relative flex size-11 items-center justify-center rounded-full transition-transform sm:size-10",
        "ring-offset-2 ring-offset-background hover:scale-105",
        isActive ? "ring-2 ring-primary" : "ring-1 ring-border",
      )}
      style={{ background: swatch }}
    >
      {isActive && (
        <Check
          className="size-4 text-primary-foreground drop-shadow-sm"
          aria-hidden
        />
      )}
      <span className="sr-only">{id}</span>
    </button>
  );
}
