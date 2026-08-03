export type JurisdictionLink = {
  authority_id: number;
  responsible_user_id: string;
  responsible_full_name: string | null;
  email_override: string | null;
  catalog_email: string | null;
  authority_sigla: string;
  authority_nome: string;
};

export type ResolveResponsibleOk = {
  ok: true;
  authorityId: number;
  authoritySigla: string;
  authorityNome: string;
  responsibleUserId: string;
  responsibleName: string;
  effectiveEmail: string | null;
};

export type ResolveResponsibleGap =
  | "missing_authority_on_location"
  | "jurisdiction_not_linked"
  | "responsible_name_empty";

export function resolveResponsibleForLocation(input: {
  authorityId: number | null | undefined;
  links: JurisdictionLink[];
}): ResolveResponsibleOk | { ok: false; gap: ResolveResponsibleGap } {
  if (input.authorityId == null || !Number.isInteger(input.authorityId)) {
    return { ok: false, gap: "missing_authority_on_location" };
  }
  const link = input.links.find((l) => l.authority_id === input.authorityId);
  if (!link) {
    return { ok: false, gap: "jurisdiction_not_linked" };
  }
  const name = link.responsible_full_name?.trim() ?? "";
  if (!name) {
    return { ok: false, gap: "responsible_name_empty" };
  }
  const override = link.email_override?.trim() || null;
  const catalog = link.catalog_email?.trim() || null;
  return {
    ok: true,
    authorityId: link.authority_id,
    authoritySigla: link.authority_sigla,
    authorityNome: link.authority_nome,
    responsibleUserId: link.responsible_user_id,
    responsibleName: name,
    effectiveEmail: override || catalog,
  };
}
