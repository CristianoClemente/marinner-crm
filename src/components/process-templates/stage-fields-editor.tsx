"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";

import { PROCESS_FIELD_TYPES } from "@/lib/processes/field-types";
import type { ProcessFieldType } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FieldDraft = {
  clientKey: string;
  id?: string;
  label: string;
  field_type: ProcessFieldType;
  required: boolean;
  optionsText: string;
  justAdded?: boolean;
};

interface StageFieldsEditorProps {
  fields: FieldDraft[];
  onChange: (fields: FieldDraft[]) => void;
}

export function StageFieldsEditor({ fields, onChange }: StageFieldsEditorProps) {
  const t = useTranslations("Processes.templates.fields");

  function update(index: number, patch: Partial<FieldDraft>) {
    const next = [...fields];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function clearJustAdded(index: number) {
    if (!fields[index]?.justAdded) return;
    update(index, { justAdded: false });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted-foreground">
          {t("title")}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() =>
            onChange([
              ...fields,
              {
                clientKey: crypto.randomUUID(),
                label: "",
                field_type: "text",
                required: false,
                optionsText: "",
                justAdded: true,
              },
            ])
          }
        >
          <Plus className="size-3.5" />
          {t("add")}
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {fields.map((field, index) => (
            <li
              key={field.clientKey}
              onAnimationEnd={() => clearJustAdded(index)}
              className={cn(
                "space-y-1.5 rounded-lg bg-muted/40 p-2.5 transition-colors",
                field.justAdded &&
                  "animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both motion-reduce:animate-none",
              )}
            >
              <div className="flex items-center gap-1.5">
                <Input
                  value={field.label}
                  onChange={(e) => update(index, { label: e.target.value })}
                  placeholder={t("labelPlaceholder")}
                  className="h-8 min-w-0 flex-1 text-base md:text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("remove")}
                  onClick={() => onChange(fields.filter((_, j) => j !== index))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={field.field_type}
                  onValueChange={(v) => {
                    if (v) update(index, { field_type: v as ProcessFieldType });
                  }}
                >
                  <SelectTrigger className="h-8 w-full sm:w-36">
                    <SelectValue>{t(`types.${field.field_type}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PROCESS_FIELD_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`types.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground sm:min-h-0">
                  <Switch
                    checked={field.required}
                    onCheckedChange={(v) => update(index, { required: v })}
                  />
                  {t("required")}
                </label>
              </div>
              {field.field_type === "select" ? (
                <Input
                  key={`${field.clientKey}-options`}
                  value={field.optionsText}
                  onChange={(e) =>
                    update(index, { optionsText: e.target.value })
                  }
                  placeholder={t("optionsPlaceholder")}
                  className="h-8 animate-in fade-in-0 slide-in-from-top-1 text-base duration-150 fill-mode-both motion-reduce:animate-none md:text-sm"
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
