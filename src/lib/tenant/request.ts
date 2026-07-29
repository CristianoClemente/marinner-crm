import { headers } from "next/headers";

import {
  TENANT_ACCOUNT_ID_HEADER,
  TENANT_LOGO_URL_HEADER,
  TENANT_NAME_HEADER,
  TENANT_SLUG_HEADER,
  type RequestTenant,
} from "./headers";

/**
 * Lê o tenant resolvido pelo middleware (Server Components / route handlers).
 * Retorna null no apex ou quando não há headers.
 */
export async function getRequestTenant(): Promise<RequestTenant | null> {
  const h = await headers();
  const accountId = h.get(TENANT_ACCOUNT_ID_HEADER);
  const slug = h.get(TENANT_SLUG_HEADER);
  const name = h.get(TENANT_NAME_HEADER);
  if (!accountId || !slug || !name) return null;

  const logo = h.get(TENANT_LOGO_URL_HEADER);
  return {
    accountId,
    slug,
    name,
    logoUrl: logo && logo.length > 0 ? logo : null,
  };
}
