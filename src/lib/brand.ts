/**
 * Nome do produto exibido ao usuário (aba, sidebar, e-mails, etc.).
 */
export const APP_NAME =
  process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Marinner";

/** Logotipo padrão Marinner (SVG estático em `public/brand/`). */
export const DEFAULT_LOGO_SRC = "/brand/marinner-logo.svg";

/**
 * Favicon padrão Marinner.
 * Mesma arte do logo; cópia em `public/` para URL estável no cliente.
 * O Next também serve `src/app/icon.svg` via convenção de metadata.
 */
export const DEFAULT_FAVICON_SRC = "/favicon.svg";
