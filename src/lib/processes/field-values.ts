import { isFieldComplete } from "@/lib/processes/field-types";
import type {
  ProcessTemplateStageField,
  ProcessFieldValueRow,
} from "@/lib/processes/types";

export type FieldWithValue = {
  field: ProcessTemplateStageField;
  value: ProcessFieldValueRow | null;
};

export function requiredMissingLabels(items: FieldWithValue[]): string[] {
  const missing: string[] = [];
  for (const item of items) {
    if (!item.field.required) continue;
    if (!isFieldComplete(item.field.field_type, item.value)) {
      missing.push(item.field.label);
    }
  }
  return missing;
}

export function fieldSummary(items: FieldWithValue[]): {
  fields_total: number;
  fields_filled: number;
  fields_required_missing: number;
} {
  let filled = 0;
  let requiredMissing = 0;
  for (const item of items) {
    const complete = isFieldComplete(item.field.field_type, item.value);
    if (complete) filled += 1;
    if (item.field.required && !complete) requiredMissing += 1;
  }
  return {
    fields_total: items.length,
    fields_filled: filled,
    fields_required_missing: requiredMissing,
  };
}
