"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Handshake, Loader2, Plus, Ship, Trash2, Waves } from "lucide-react";

import { useCan } from "@/hooks/use-can";
import {
  getQuickStartTemplate,
  QUICK_START_ORDER,
  QUICK_START_TEMPLATES,
  type QuickStartIcon,
  type QuickStartSlug,
} from "@/lib/processes/quick-start-templates";
import { cn } from "@/lib/utils";
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
  DialogDescription,
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

const QUICK_START_ICONS: Record<
  QuickStartIcon,
  typeof Handshake
> = {
  Handshake,
  Ship,
  Waves,
};

type StageDraft = {
  clientKey: string;
  id?: string;
  name: string;
  allow_skip: boolean;
  accepts_classes: boolean;
  fields: FieldDraft[];
  justAdded?: boolean;
};

const DEFAULT_STAGE_DEFS: Omit<StageDraft, "clientKey" | "fields">[] = [
  { name: "Documentação", allow_skip: false, accepts_classes: false },
  { name: "Pagamento", allow_skip: false, accepts_classes: false },
  { name: "Aula prática", allow_skip: false, accepts_classes: true },
  { name: "Prova", allow_skip: false, accepts_classes: false },
  { name: "Concluído", allow_skip: false, accepts_classes: false },
];

function freshDefaultStages(): StageDraft[] {
  return DEFAULT_STAGE_DEFS.map((s) => ({
    ...s,
    clientKey: crypto.randomUUID(),
    fields: [],
  }));
}

export default function ProcessTemplatesPage() {
  const t = useTranslations("Processes.templates");
  const canManage = useCan("edit-settings");
  const nameId = useId();
  const [templates, setTemplates] = useState<ProcessTemplate[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessTemplate | null>(null);
  const [name, setName] = useState("");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [blockAdvance, setBlockAdvance] = useState(false);
  const [advanceMode, setAdvanceMode] = useState<"free" | "sequential">(
    "sequential",
  );
  const [hasMonetaryValue, setHasMonetaryValue] = useState(false);
  const [hasCommercialOutcome, setHasCommercialOutcome] = useState(false);
  const [requiresCatalog, setRequiresCatalog] = useState(true);
  const [stages, setStages] = useState<StageDraft[]>(() => freshDefaultStages());
  const [saving, setSaving] = useState(false);
  const [fromPreset, setFromPreset] = useState<QuickStartSlug | null>(null);

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
    setFromPreset(null);
    setName("");
    setCatalogItemId(items[0]?.id ?? "");
    setBlockAdvance(false);
    setAdvanceMode("sequential");
    setHasMonetaryValue(false);
    setHasCommercialOutcome(false);
    setRequiresCatalog(true);
    setStages(freshDefaultStages());
    setOpen(true);
  }

  function openCreateFromPreset(slug: QuickStartSlug) {
    const preset = getQuickStartTemplate(slug);
    setEditing(null);
    setFromPreset(slug);
    setName(preset.defaultName);
    setCatalogItemId(
      preset.capabilities.requires_catalog_item ? (items[0]?.id ?? "") : "",
    );
    setBlockAdvance(preset.capabilities.block_advance_if_incomplete);
    setAdvanceMode(preset.capabilities.advance_mode);
    setHasMonetaryValue(preset.capabilities.has_monetary_value);
    setHasCommercialOutcome(preset.capabilities.has_commercial_outcome);
    setRequiresCatalog(preset.capabilities.requires_catalog_item);
    setStages(
      preset.stages.map((stage) => ({
        clientKey: crypto.randomUUID(),
        name: stage.name,
        allow_skip: stage.allow_skip,
        accepts_classes: stage.accepts_classes,
        fields: stage.fields.map((field) => ({
          clientKey: crypto.randomUUID(),
          label: field.label,
          field_type: field.field_type,
          required: field.required,
          optionsText: (field.options ?? []).join(", "),
        })),
      })),
    );
    setOpen(true);
  }

  async function openEdit(tpl: ProcessTemplate) {
    setFromPreset(null);
    setEditing(tpl);
    setName(tpl.name);
    setCatalogItemId(tpl.catalog_item_id ?? "");
    setBlockAdvance(Boolean(tpl.block_advance_if_incomplete));
    setAdvanceMode(tpl.advance_mode ?? "sequential");
    setHasMonetaryValue(Boolean(tpl.has_monetary_value));
    setHasCommercialOutcome(Boolean(tpl.has_commercial_outcome));
    setRequiresCatalog(
      tpl.requires_catalog_item === undefined
        ? true
        : Boolean(tpl.requires_catalog_item),
    );
    const baseStages = (tpl.stages ?? []).map((s) => ({
      clientKey: s.id,
      id: s.id,
      name: s.name,
      allow_skip: s.allow_skip,
      accepts_classes: Boolean(s.accepts_classes),
      fields: [] as FieldDraft[],
    }));
    setStages(baseStages.length > 0 ? baseStages : freshDefaultStages());
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
            clientKey: f.id,
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
    if (!name.trim()) {
      toast.error(t("requiredFields"));
      return;
    }
    if (requiresCatalog && !catalogItemId) {
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
      const capabilities = {
        name: name.trim(),
        catalog_item_id: requiresCatalog ? catalogItemId : catalogItemId || null,
        block_advance_if_incomplete: blockAdvance,
        advance_mode: advanceMode,
        has_monetary_value: hasMonetaryValue,
        has_commercial_outcome: hasCommercialOutcome,
        requires_catalog_item: requiresCatalog,
        ...(fromPreset
          ? {
              habilitation_kind:
                getQuickStartTemplate(fromPreset).habilitationKind ?? null,
            }
          : {}),
      };
      if (editing) {
        const res = await fetch(`/api/process-templates/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(capabilities),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || t("saveFailed"));
      } else {
        const res = await fetch("/api/process-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(capabilities),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || t("saveFailed"));
        templateId = json.template?.id;
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

  function updateStage(index: number, patch: Partial<StageDraft>) {
    setStages((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function addStage() {
    setStages((prev) => [
      ...prev,
      {
        clientKey: crypto.randomUUID(),
        name: "",
        allow_skip: false,
        accepts_classes: false,
        fields: [],
        justAdded: true,
      },
    ]);
  }

  if (!canManage) {
    return (
      <div className="p-6 text-sm text-muted-foreground">{t("adminOnly")}</div>
    );
  }

  return (
    <div className="animate-in fade-in-50 space-y-6 p-6 duration-200 motion-reduce:animate-none">
      <div className="flex items-start justify-between gap-3 sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          type="button"
          aria-label={t("new")}
          className="size-9 shrink-0 p-0 sm:h-8 sm:w-auto sm:px-2.5"
          onClick={openCreate}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">{t("new")}</span>
        </Button>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          {t("quickStart.title")}
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {QUICK_START_ORDER.map((slug) => {
            const preset = QUICK_START_TEMPLATES[slug];
            const Icon = QUICK_START_ICONS[preset.icon];
            return (
              <button
                key={slug}
                type="button"
                onClick={() => openCreateFromPreset(slug)}
                className="group flex flex-col items-start rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-card/80"
              >
                <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15">
                  <Icon className="size-5" />
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {t(`quickStart.${slug}.name`)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(`quickStart.${slug}.description`)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("quickStart.meta", {
                    stages: preset.stages.length,
                    mode: t(`quickStart.mode.${preset.capabilities.advance_mode}`),
                    kind: t(`quickStart.kind.${preset.kind}`),
                  })}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("loading")}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none">
          <p className="text-sm font-medium text-foreground">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyDesc")}</p>
          <Button type="button" className="mt-4" onClick={openCreate}>
            <Plus className="size-4" />
            {t("new")}
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {templates.map((tpl) => (
            <li
              key={tpl.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{tpl.name}</p>
                <p className="text-xs text-muted-foreground">
                  {tpl.catalog_item?.name ?? t("catalogOptional")} ·{" "}
                  {(tpl.stages ?? []).length} {t("stagesCount")} ·{" "}
                  {tpl.advance_mode === "free"
                    ? t("modeFreeShort")
                    : t("modeSequentialShort")}
                  {!tpl.active ? ` · ${t("inactive")}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
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

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setFromPreset(null);
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-4 sm:px-6">
            <DialogTitle>
              {editing ? t("editTitle") : t("createTitle")}
            </DialogTitle>
            <DialogDescription>
              {fromPreset
                ? t(
                    getQuickStartTemplate(fromPreset).kind === "process"
                      ? "quickStart.hintNormam"
                      : "quickStart.hint",
                  )
                : t("dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-6 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={nameId}>{t("name")}</Label>
                <Input
                  id={nameId}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  className="text-base md:text-sm"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("advanceMode")}</Label>
                <Select
                  value={advanceMode}
                  onValueChange={(v) => {
                    if (v === "free" || v === "sequential") setAdvanceMode(v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {advanceMode === "free"
                        ? t("advanceModeFree")
                        : t("advanceModeSequential")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sequential">
                      {t("advanceModeSequential")}
                    </SelectItem>
                    <SelectItem value="free">{t("advanceModeFree")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-base font-medium leading-snug text-foreground">
                {t("sectionCapabilities")}
              </p>
              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40">
                  <Switch
                    checked={requiresCatalog}
                    onCheckedChange={setRequiresCatalog}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 text-sm text-foreground">
                    {t("requiresCatalog")}
                  </span>
                </label>
                {requiresCatalog ? (
                  <div
                    key="catalog-required"
                    className="space-y-1.5 px-3 py-2.5 animate-in fade-in-0 slide-in-from-top-1 duration-200 fill-mode-both motion-reduce:animate-none"
                  >
                    <Label>{t("catalogItem")}</Label>
                    {items.length === 0 ? (
                      <p className="text-xs leading-relaxed text-muted-foreground">
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
                ) : (
                  <p
                    key="catalog-optional"
                    className="px-3 py-2.5 text-xs leading-relaxed text-muted-foreground animate-in fade-in-0 slide-in-from-top-1 duration-200 fill-mode-both motion-reduce:animate-none"
                  >
                    {t("catalogOptional")}
                  </p>
                )}
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40">
                  <Switch
                    checked={hasMonetaryValue}
                    onCheckedChange={setHasMonetaryValue}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 text-sm text-foreground">
                    {t("hasMonetaryValue")}
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40">
                  <Switch
                    checked={hasCommercialOutcome}
                    onCheckedChange={setHasCommercialOutcome}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 text-sm text-foreground">
                    {t("hasCommercialOutcome")}
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40">
                  <Switch
                    checked={blockAdvance}
                    onCheckedChange={setBlockAdvance}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">
                      {t("blockAdvance")}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {t("blockAdvanceHint")}
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-base font-medium leading-snug text-foreground">
                  {t("stages")}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={addStage}>
                  <Plus className="size-3.5" />
                  {t("addStage")}
                </Button>
              </div>

              <div className="space-y-3">
                {stages.map((s, i) => (
                  <div
                    key={s.clientKey}
                    onAnimationEnd={() => {
                      if (s.justAdded) updateStage(i, { justAdded: false });
                    }}
                    className={cn(
                      "space-y-2.5 rounded-lg border border-border p-3 transition-colors",
                      s.justAdded &&
                        "animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both motion-reduce:animate-none",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className="mt-2.5 w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground"
                      >
                        {i + 1}
                      </span>
                      <Input
                        value={s.name}
                        onChange={(e) =>
                          updateStage(i, { name: e.target.value })
                        }
                        placeholder={t("stageName")}
                        className="min-w-0 flex-1 text-base md:text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                        aria-label={t("removeStage")}
                        onClick={() =>
                          setStages((prev) => prev.filter((_, j) => j !== i))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-7">
                      {advanceMode === "sequential" ? (
                        <label
                          key="allow-skip"
                          className="flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground animate-in fade-in-0 slide-in-from-left-1 duration-150 fill-mode-both motion-reduce:animate-none sm:min-h-0"
                        >
                          <Switch
                            checked={s.allow_skip}
                            onCheckedChange={(v) =>
                              updateStage(i, { allow_skip: v })
                            }
                          />
                          {t("allowSkip")}
                        </label>
                      ) : null}
                      <label className="flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground sm:min-h-0">
                        <Switch
                          checked={s.accepts_classes}
                          onCheckedChange={(v) =>
                            updateStage(i, { accepts_classes: v })
                          }
                        />
                        {t("acceptsClasses")}
                      </label>
                    </div>

                    <div className="pl-7">
                      <StageFieldsEditor
                        fields={s.fields}
                        onChange={(fields) => updateStage(i, { fields })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none px-4 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              disabled={saving || (requiresCatalog && !catalogItemId)}
              onClick={() => void save()}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
