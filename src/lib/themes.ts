/**
 * Single source of truth for the color-theme catalog.
 *
 * The CSS variables themselves live in `src/app/globals.css` under
 * `html[data-theme="..."]` blocks — that file is the one we paste
 * theme tokens into. This module only carries the metadata the UI
 * (settings picker, no-flash boot script) needs.
 *
 * Adding a new theme is a two-step change:
 *   1. Append the new `html[data-theme="<id>"]` block in globals.css
 *      with every token from an existing theme (use violet as the
 *      shape reference).
 *   2. Add an entry below. The order here drives the picker grid.
 */

// Ordem = roda de cores (laranja → âmbar → … → neutro), que é como o
// seletor de destaque é lido na tela.
export const THEME_IDS = [
  "orange",
  "amber",
  "yellow",
  "rose",
  "fuchsia",
  "violet",
  "indigo",
  "cobalt",
  "cyan",
  "teal",
  "emerald",
  "lime",
  "slate",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "orange";

export const STORAGE_KEY = "marinner.theme";

/**
 * MODE — the light/dark dimension, orthogonal to the accent theme.
 *
 * The CSS variables live in `src/app/globals.css` under
 * `html[data-mode="..."]` blocks (neutral surfaces only). Applied
 * at runtime via `document.documentElement.dataset.mode`. Dark is
 * the historical default and stays the app's identity; light is the
 * opt-in eye-strain-friendly alternative.
 *
 * Persisted under its own localStorage key so it composes freely
 * with the accent choice (you can run Violet-light or Violet-dark).
 */
export const MODES = ["light", "dark"] as const;

export type Mode = (typeof MODES)[number];

export const DEFAULT_MODE: Mode = "dark";

export const MODE_STORAGE_KEY = "marinner.mode";

export function isMode(value: unknown): value is Mode {
  return (
    typeof value === "string" && (MODES as ReadonlyArray<string>).includes(value)
  );
}

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  tagline: string;
  /**
   * Static swatch color for the picker chip. Hard-coded so the boot
   * script / picker cards don't need a getComputedStyle round trip
   * before the page settles. Must mirror `--primary` of the same
   * theme in globals.css.
   */
  swatch: string;
}

export const THEMES: ReadonlyArray<ThemeMeta> = [
  {
    id: "orange",
    name: "Laranja",
    tagline: "O padrão — o laranja do logotipo Marinner.",
    swatch: "oklch(0.646 0.222 41)",
  },
  {
    id: "amber",
    name: "Âmbar",
    tagline: "Quente e acolhedor — combina com equipes pequenas.",
    swatch: "oklch(0.745 0.16 65)",
  },
  {
    id: "yellow",
    name: "Amarelo",
    tagline: "Solar e otimista — o destaque mais luminoso da lista.",
    swatch: "oklch(0.795 0.184 86)",
  },
  {
    id: "rose",
    name: "Rosa",
    tagline: "Ousado e moderno — D2C, creator economy, lifestyle.",
    swatch: "oklch(0.645 0.22 16)",
  },
  {
    id: "fuchsia",
    name: "Magenta",
    tagline: "Vibrante e criativo — para marcas que gostam de aparecer.",
    swatch: "oklch(0.62 0.26 322)",
  },
  {
    id: "violet",
    name: "Violeta",
    tagline: "Confiante e um pouco lúdico.",
    swatch: "oklch(0.526 0.247 293)",
  },
  {
    id: "indigo",
    name: "Índigo",
    tagline: "Sóbrio com um toque de energia — bom para uso longo.",
    swatch: "oklch(0.545 0.23 277)",
  },
  {
    id: "cobalt",
    name: "Cobalto",
    tagline: "Azul de SaaS B2B — calmo e profissional.",
    swatch: "oklch(0.585 0.2 254)",
  },
  {
    id: "cyan",
    name: "Ciano",
    tagline: "Claro e técnico — destaca bem em telas escuras.",
    swatch: "oklch(0.715 0.143 215)",
  },
  {
    id: "teal",
    name: "Turquesa",
    tagline: "Equilíbrio entre o azul e o verde — sereno.",
    swatch: "oklch(0.704 0.14 182)",
  },
  {
    id: "emerald",
    name: "Esmeralda",
    tagline: "Clima de crescimento, sem copiar o verde do WhatsApp.",
    swatch: "oklch(0.62 0.16 162)",
  },
  {
    id: "lime",
    name: "Limão",
    tagline: "Alto contraste e energético — chama atenção nas ações.",
    swatch: "oklch(0.768 0.194 130)",
  },
  {
    id: "slate",
    name: "Grafite",
    tagline: "Neutro e discreto — deixa o conteúdo em primeiro plano.",
    swatch: "oklch(0.554 0.046 257)",
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    (THEME_IDS as ReadonlyArray<string>).includes(value)
  );
}
