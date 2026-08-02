export type ProcessStatus = "active" | "completed" | "canceled";

export type ProcessDomainEventType =
  | "process.created"
  | "process.stage_changed"
  | "process.completed"
  | "process.canceled";

export interface ProcessTemplateStage {
  id: string;
  account_id: string;
  template_id: string;
  name: string;
  position: number;
  allow_skip: boolean;
  accepts_classes: boolean;
  created_at: string;
}

export interface ProcessTemplate {
  id: string;
  account_id: string;
  catalog_item_id: string;
  name: string;
  active: boolean;
  block_advance_if_incomplete?: boolean;
  created_at: string;
  updated_at: string;
  stages?: ProcessTemplateStage[];
  catalog_item?: { id: string; name: string } | null;
}

export interface EnrollmentProcess {
  id: string;
  account_id: string;
  contact_id: string;
  template_id: string;
  current_stage_id: string | null;
  status: ProcessStatus;
  opened_at: string;
  completed_at: string | null;
  canceled_at: string | null;
  opened_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  template?: ProcessTemplate | null;
  current_stage?: ProcessTemplateStage | null;
  contact?: {
    id: string;
    name: string | null;
    phone: string | null;
    cpf?: string | null;
  } | null;
}

export interface ProcessStageHistory {
  id: string;
  account_id: string;
  process_id: string;
  from_stage_id: string | null;
  to_stage_id: string | null;
  actor_user_id: string | null;
  note: string | null;
  created_at: string;
}

export type ProcessTemplateStageInput = {
  name: string;
  position: number;
  allow_skip: boolean;
  accepts_classes: boolean;
};

export type ProcessFieldType =
  | "file"
  | "checkbox"
  | "text"
  | "textarea"
  | "date"
  | "select";

export interface ProcessTemplateStageField {
  id: string;
  account_id: string;
  stage_id: string;
  label: string;
  field_type: ProcessFieldType;
  required: boolean;
  position: number;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProcessFieldValueRow {
  id: string;
  account_id: string;
  process_id: string;
  field_id: string;
  value: unknown;
  storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  updated_at: string;
  updated_by_user_id: string | null;
}

/** Resumo da etapa atual para badge no board. */
export type ProcessFieldsSummary = {
  fields_total: number;
  fields_filled: number;
  fields_required_missing: number;
};

export type ProcessTemplateStageFieldInput = {
  id?: string;
  label: string;
  field_type: ProcessFieldType;
  required: boolean;
  position: number;
  config?: Record<string, unknown>;
};
