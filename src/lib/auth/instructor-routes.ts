/** Paths que o role `instructor` pode abrir no dashboard. */

const INSTRUCTOR_ALLOWED_PREFIXES = [
  "/my-availability",
  "/settings",
] as const;

export function isInstructorAllowedPath(pathname: string): boolean {
  return INSTRUCTOR_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Destino padrão quando o instructor acessa rota operacional. */
export const INSTRUCTOR_HOME = "/my-availability";
