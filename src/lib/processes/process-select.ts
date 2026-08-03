/** Select compartilhado das rotas de processo (instância + joins). */
export const PROCESS_SELECT =
  "*, template:process_templates(id, name, catalog_item_id, active, block_advance_if_incomplete, advance_mode, has_monetary_value, has_commercial_outcome, requires_catalog_item), current_stage:process_template_stages!enrollment_processes_current_stage_id_fkey(*), contact:contacts(id, name, phone, cpf)";

export function parseCommercialCreateFields(body: Record<string, unknown>): {
  title: string | null;
  value: number;
  currency: string | null;
  assigned_to: string | null;
  expected_close_date: string | null;
  conversation_id: string | null;
  commercial_status: "open" | null;
} {
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : null;
  const valueRaw =
    typeof body.value === "number" ? body.value : Number(body.value);
  const value =
    Number.isFinite(valueRaw) && valueRaw >= 0 ? Number(valueRaw) : 0;
  const currency =
    typeof body.currency === "string" && body.currency.trim()
      ? body.currency.trim().slice(0, 8).toUpperCase()
      : null;
  const assigned_to =
    typeof body.assigned_to === "string" && body.assigned_to
      ? body.assigned_to
      : null;
  const expected_close_date =
    typeof body.expected_close_date === "string" && body.expected_close_date
      ? body.expected_close_date.slice(0, 10)
      : null;
  const conversation_id =
    typeof body.conversation_id === "string" && body.conversation_id
      ? body.conversation_id
      : null;
  return {
    title,
    value,
    currency,
    assigned_to,
    expected_close_date,
    conversation_id,
    commercial_status: null,
  };
}
