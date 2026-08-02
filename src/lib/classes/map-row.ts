/** Select padrão para listagem/detalhe de turmas na Agenda. */
export const PROCESS_CLASS_SELECT = `
  *,
  enrolled_count:process_class_enrollments(count),
  template_stage:process_template_stages(
    id,
    name,
    template_id,
    accepts_classes,
    template:process_templates(
      id,
      name,
      catalog_item:catalog_items(id, name)
    )
  ),
  location:class_locations(id, name),
  instructor:instructors(id, full_name),
  equipment:equipment(id, name)
`.replace(/\s+/g, " ");

export function mapClassRow(row: Record<string, unknown>) {
  const enrolledRaw = row.enrolled_count as
    | Array<{ count: number }>
    | number
    | null
    | undefined;
  let enrolled_count = 0;
  if (Array.isArray(enrolledRaw) && enrolledRaw[0]) {
    enrolled_count = Number(enrolledRaw[0].count) || 0;
  } else if (typeof enrolledRaw === "number") {
    enrolled_count = enrolledRaw;
  }

  const stageRaw = row.template_stage as
    | {
        id: string;
        name: string;
        template_id: string;
        accepts_classes?: boolean;
        template?: {
          id: string;
          name: string;
          catalog_item?: { id: string; name: string } | null;
        } | null;
      }
    | null
    | undefined;

  return {
    ...row,
    enrolled_count,
    template_stage: stageRaw
      ? {
          id: stageRaw.id,
          name: stageRaw.name,
          template_id: stageRaw.template_id,
          accepts_classes: stageRaw.accepts_classes,
        }
      : null,
    template: stageRaw?.template ?? null,
  };
}
