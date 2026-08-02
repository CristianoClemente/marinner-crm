"use client";

import { useTranslations } from "next-intl";
import { FileUp, Trash2 } from "lucide-react";

import { parseFieldConfig } from "@/lib/processes/field-types";
import type {
  ProcessFieldValueRow,
  ProcessTemplateStageField,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FieldDraftValue = {
  value: unknown;
  file: File | null;
  clearFile: boolean;
  existing: ProcessFieldValueRow | null;
};

interface ProcessFieldControlProps {
  field: ProcessTemplateStageField;
  draft: FieldDraftValue;
  disabled?: boolean;
  onChange: (draft: FieldDraftValue) => void;
}

export function ProcessFieldControl({
  field,
  draft,
  disabled,
  onChange,
}: ProcessFieldControlProps) {
  const t = useTranslations("Processes.fields");
  const config = parseFieldConfig(field.config);
  const label = (
    <Label className="text-sm">
      {field.label}
      {field.required ? (
        <span className="text-destructive"> *</span>
      ) : null}
    </Label>
  );

  if (field.field_type === "checkbox") {
    return (
      <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
        <Switch
          checked={draft.value === true}
          disabled={disabled}
          onCheckedChange={(v) => onChange({ ...draft, value: v })}
        />
        <span className="text-sm text-foreground">
          {field.label}
          {field.required ? (
            <span className="text-destructive"> *</span>
          ) : null}
        </span>
      </label>
    );
  }

  if (field.field_type === "textarea") {
    return (
      <div className="space-y-1.5">
        {label}
        <Textarea
          value={typeof draft.value === "string" ? draft.value : ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, value: e.target.value })}
          rows={3}
          className="text-base md:text-sm"
        />
      </div>
    );
  }

  if (field.field_type === "date") {
    return (
      <div className="space-y-1.5">
        {label}
        <Input
          type="date"
          value={typeof draft.value === "string" ? draft.value : ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, value: e.target.value })}
          className="text-base md:text-sm"
        />
      </div>
    );
  }

  if (field.field_type === "select") {
    const options = config.options ?? [];
    const current = typeof draft.value === "string" ? draft.value : "";
    return (
      <div className="space-y-1.5">
        {label}
        <Select
          value={current || undefined}
          disabled={disabled}
          onValueChange={(v) => {
            if (v) onChange({ ...draft, value: v });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("selectPlaceholder")}>
              {current || t("selectPlaceholder")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.field_type === "file") {
    const showExisting =
      !draft.clearFile &&
      !draft.file &&
      Boolean(draft.existing?.storage_path);
    return (
      <div className="space-y-1.5">
        {label}
        {showExisting ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <span className="min-w-0 truncate text-foreground">
              {draft.existing?.original_filename ?? t("fileAttached")}
            </span>
            {!disabled ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({ ...draft, clearFile: true, file: null })
                }
              >
                <Trash2 className="size-3.5" />
                {t("removeFile")}
              </Button>
            ) : null}
          </div>
        ) : null}
        {draft.file ? (
          <p className="text-xs text-muted-foreground">
            {t("fileSelected", { name: draft.file.name })}
          </p>
        ) : null}
        {!disabled ? (
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <FileUp className="size-3.5" />
            {t("chooseFile")}
            <input
              type="file"
              className="sr-only"
              accept={config.accept}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                onChange({
                  ...draft,
                  file,
                  clearFile: false,
                });
              }}
            />
          </label>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {label}
      <Input
        value={typeof draft.value === "string" ? draft.value : ""}
        disabled={disabled}
        onChange={(e) => onChange({ ...draft, value: e.target.value })}
        className="text-base md:text-sm"
      />
    </div>
  );
}
