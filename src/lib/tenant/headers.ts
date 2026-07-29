/**
 * Headers internos injetados pelo middleware após resolver o tenant.
 * Nunca confiar em valores enviados pelo cliente — o middleware sobrescreve.
 */

/** Header que o middleware injeta (e que o cliente pode enviar em development no apex). */
export const TENANT_SLUG_HEADER = "x-tenant-slug";
export const TENANT_ACCOUNT_ID_HEADER = "x-tenant-account-id";
export const TENANT_NAME_HEADER = "x-tenant-name";
export const TENANT_LOGO_URL_HEADER = "x-tenant-logo-url";

export interface RequestTenant {
  accountId: string;
  slug: string;
  name: string;
  logoUrl: string | null;
}

export interface TenantBrandRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}
