"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { useCan } from "@/hooks/use-can";
import type { CatalogItem, ProcessTemplate } from "@/types";
import {
  StageFieldsEditor,
  type FieldDraft,
} from "@/components/process-templates/stage-fields-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type StageDraft = {
  id?: string;
  name: string;
  allow_skip: boolean;
  accepts_classes: boolean;
  fields: FieldDraft[];
};

const DEFAULT_STAGES: StageDraft[] = [
  { name: "Documentação", allow_skip: false, accepts_classes: false, fields: [] },
  { name: "Pagamento", allow_skip: false, accepts_classes: false, fields: [] },
  {
    name: "Aula prática",
    allow_skip: false,
    accepts_classes: true,
    fields: [],
  },
  { name: "Prova", allow_skip: false, accepts_classes: false, fields: [] },
  { name: "Concluído", allow_skip: false, accepts_classes: false, fields: [] },
];

export default function ProcessTemplatesPage() {
  const t = useTranslations("Processes.templates");
  const canManage = useCan("edit-settings");
  const [templates, setTemplates] = useState<ProcessTemplate[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessTemplate | null>(null);
  const [name, setName] = useState("");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [blockAdvance, setBlockAdvance] = useState(false);
  const [stages, setStages] = useState<StageDraft[]>(DEFAULT_STAGES);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tplRes, catRes] = await Promise.all([
        fetch("/api/process-templates"),
        fetch("/api/catalog?active=true&kind=service"),
      ]);
      const tplJson = await tplRes.json().catch(() => ({}));
      const catJson = await catRes.json().catch(() => ({}));
      if (!tplRes.ok) throw new Error(tplJson.error || t("loadFailed"));
      setTemplates(tplJson.templates ?? []);
      setItems(catJson.items ?? catJson.catalog_items ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName("");
    setCatalogItemId(items[0]?.id ?? "");
    setBlockAdvance(false);
    setStages(DEFAULT_STAGES.map((s) => ({ ...s, fields: [] })));
    setOpen(true);
  }

  async function openEdit(tpl: ProcessTemplate) {
    setEditing(tpl);
    setName(tpl.name);
    setCatalogItemId(tpl.catalog_item_id);
    setBlockAdvance(Boolean(tpl.block_advance_if_incomplete));
    const baseStages = (tpl.stages ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      allow_skip: s.allow_skip,
      accepts_classes: Boolean(s.accepts_classes),
      fields: [] as FieldDraft[],
    }));
    setStages(baseStages.length > 0 ? baseStages : DEFAULT_STAGES);
    setOpen(true);

    const withFields = await Promise.all(
      baseStages.map(async (stage) => {
        if (!stage.id) return stage;
        const res = await fetch(
          `/api/process-templates/${tpl.id}/stages/${stage.id}/fields`,
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return stage;
        const fields: FieldDraft[] = (json.fields ?? []).map(
          (f: {
            id: string;
            label: string;
            field_type: FieldDraft["field_type"];
            required: boolean;
            config?: { options?: string[] };
          }) => ({
            id: f.id,
            label: f.label,
            field_type: f.field_type,
            required: f.required,
            optionsText: (f.config?.options ?? []).join(", "),
          }),
        );
        return { ...stage, fields };
      }),
    );
    setStages(withFields);
  }

  async function save() {
    if (!canManage) return;
    if (!name.trim() || !catalogItemId) {
      toast.error(t("requiredFields"));
      return;
    }
    if (stages.some((s) => !s.name.trim())) {
      toast.error(t("stageNameRequired"));
      return;
    }
    for (const stage of stages) {
      for (const field of stage.fields) {
        if (!field.label.trim()) {
          toast.error(t("fields.labelRequired"));
          return;
        }
        if (
          field.field_type === "select" &&
          field.optionsText
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean).length === 0
        ) {
          toast.error(t("fields.optionsRequired"));
          return;
        }
      }
    }

    setSaving(true);
    try {
      let templateId = editing?.id;
      if (editing) {
        const res = await fetch(`/api/process-templates/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            catalog_item_id: catalogItemId,
            block_advance_if_incomplete: blockAdvance,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || t("saveFailed"));
      } else {
        const res = await fetch("/api/process-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            catalog_item_id: catalogItemId,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || t("saveFailed"));
        templateId = json.template?.id;
        if (templateId && blockAdvance) {
          await fetch(`/api/process-templates/${templateId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ block_advance_if_incomplete: true }),
          });
        }
      }

      if (!templateId) throw new Error(t("saveFailed"));

      const stagesRes = await fetch(
        `/api/process-templates/${templateId}/stages`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stages: stages.map((s, i) => ({
              id: s.id,
              name: s.name.trim(),
              position: i,
              allow_skip: s.allow_skip,
              accepts_classes: s.accepts_classes,
            })),
          }),
        },
      );
      const stagesJson = await stagesRes.json().catch(() => ({}));
      if (!stagesRes.ok) {
        throw new Error(stagesJson.error || t("saveFailed"));
      }
      const savedStages = (stagesJson.stages ?? []) as Array<{ id: string }>;

      for (let i = 0; i < stages.length; i++) {
        const stageId = savedStages[i]?.id;
        if (!stageId) continue;
        const fieldsRes = await fetch(
          `/api/process-templates/${templateId}/stages/${stageId}/fields`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fields: stages[i].fields.map((f, j) => ({
                id: f.id,
                label: f.label.trim(),
                field_type: f.field_type,
                required: f.required,
                position: j,
                config:
                  f.field_type === "select"
                    ? {
                        options: f.optionsText
                          .split(",")
                          .map((o) => o.trim())
                          .filter(Boolean),
                      }
                    : {},
              })),
            }),
          },
        );
        const fieldsJson = await fieldsRes.json().catch(() => ({}));
        if (!fieldsRes.ok) {
          throw new Error(fieldsJson.error || t("saveFailed"));
        }
      }

      toast.success(t("saveSuccess"));
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(tpl: ProcessTemplate) {
    if (!canManage) return;
    const res = await fetch(`/api/process-templates/${tpl.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !tpl.active }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error || t("saveFailed"));
      return;
    }
    await load();
  }

  if (!canManage) {
    return (
      <div className="p-6 text-sm text-muted-foreground">{t("adminOnly")}</div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" />
          {t("new")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("loading")}
        </div>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {templates.map((tpl) => (
            <li
              key={tpl.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{tpl.name}</p>
                <p className="text-xs text-muted-foreground">
                  {tpl.catalog_item?.name ?? t("catalogPlaceholder")} ·{" "}
                  {(tpl.stages ?? []).length} {t("stagesCount")}
                  {!tpl.active ? ` · ${t("inactive")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void toggleActive(tpl)}
                >
                  {tpl.active ? t("deactivate") : t("activate")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void openEdit(tpl)}
                >
                  {t("edit")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-x-hidden overflow-y-auto overscroll-contain sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("editTitle") : t("createTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("catalogItem")}</Label>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("noServices")}
                </p>
              ) : (
                <Select
                  value={catalogItemId}
                  onValueChange={(v) => {
                    if (v) setCatalogItemId(v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("catalogPlaceholder")}>
                      {items.find((i) => i.id === catalogItemId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2">
              <Switch
                checked={blockAdvance}
                onCheckedChange={setBlockAdvance}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">
                  {t("blockAdvance")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("blockAdvanceHint")}
                </span>
              </span>
            </label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("stages")}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setStages((prev) => [
                      ...prev,
                      {
                        name: "",
                        allow_skip: false,
                        accepts_classes: false,
                        fields: [],
                      },
                    ])
                  }
                >
                  <Plus className="size-3.5" />
                  {t("addStage")}
                </Button>
              </div>
              {stages.map((s, i) => (
                <div
                  key={s.id ?? `stage-${i}`}
                  className="space-y-2 rounded-lg border border-border p-2"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={s.name}
                      onChange={(e) => {
                        const next = [...stages];
                        next[i] = { ...next[i], name: e.target.value };
                        setStages(next);
                      }}
                      placeholder={t("stageName")}
                    />
                    <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
                      <Switch
                        checked={s.allow_skip}
                        onCheckedChange={(v) => {
                          const next = [...stages];
                          next[i] = { ...next[i], allow_skip: v };
                          setStages(next);
                        }}
                      />
                      {t("allowSkip")}
                    </label>
                    <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
                      <Switch
                        checked={s.accepts_classes}
                        onCheckedChange={(v) => {
                          const next = [...stages];
                          next[i] = { ...next[i], accepts_classes: v };
                          setStages(next);
                        }}
                      />
                      {t("acceptsClasses")}
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setStages((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <StageFieldsEditor
                    fields={s.fields}
                    onChange={(fields) => {
                      const next = [...stages];
                      next[i] = { ...next[i], fields };
                      setStages(next);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              disabled={saving || items.length === 0}
              onClick={() => void save()}
            >
              {saving ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
