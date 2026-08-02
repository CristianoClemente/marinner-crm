"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type StageOption = {
  id: string;
  name: string;
  template?: {
    id: string;
    name: string;
    catalog_item?: { id: string; name: string } | null;
  } | null;
};

type LocationOpt = { id: string; name: string };
type InstructorOpt = { id: string; full_name: string };
type EquipmentOpt = { id: string; name: string };

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(local: string): string {
  return new Date(local).toISOString();
}

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

interface TurmaEventSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStartsAt?: string | null;
  canManage: boolean;
  onCreated: (classId: string) => void;
}

export function TurmaEventSheet({
  open,
  onOpenChange,
  defaultStartsAt,
  canManage,
  onCreated,
}: TurmaEventSheetProps) {
  const t = useTranslations("Agenda");

  const [saving, setSaving] = useState(false);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [locations, setLocations] = useState<LocationOpt[]>([]);
  const [instructors, setInstructors] = useState<InstructorOpt[]>([]);
  const [equipment, setEquipment] = useState<EquipmentOpt[]>([]);

  const [stageId, setStageId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [capacity, setCapacity] = useState("8");
  const [name, setName] = useState("");

  const resetForm = useCallback(() => {
    setStageId("");
    setLocationId("");
    setInstructorId("");
    setEquipmentId("");
    setCapacity("8");
    setName("");
    const base = defaultStartsAt ? new Date(defaultStartsAt) : new Date();
    if (!defaultStartsAt) base.setHours(9, 0, 0, 0);
    setStartsAtLocal(toLocalInputValue(base.toISOString()));
  }, [defaultStartsAt]);

  useEffect(() => {
    if (!open) return;

    const ac = new AbortController();
    let alive = true;
    resetForm();

    void (async () => {
      try {
        const [stRes, locRes, instRes, eqRes] = await Promise.all([
          fetch("/api/classes/stage-options", { signal: ac.signal }),
          fetch("/api/class-locations?status=active", { signal: ac.signal }),
          fetch("/api/instructors?status=active", { signal: ac.signal }),
          fetch("/api/equipment?status=active", { signal: ac.signal }),
        ]);
        if (!alive) return;
        const stJson = await stRes.json().catch(() => ({}));
        const locJson = await locRes.json().catch(() => ({}));
        const instJson = await instRes.json().catch(() => ({}));
        const eqJson = await eqRes.json().catch(() => ({}));
        if (!alive) return;
        if (stRes.ok) setStages(stJson.stages ?? []);
        if (locRes.ok) setLocations(locJson.locations ?? []);
        if (instRes.ok) setInstructors(instJson.instructors ?? []);
        if (eqRes.ok) setEquipment(eqJson.equipment ?? []);
      } catch {
        // Abort / fechar sheet: não reportar
      }
    })();

    return () => {
      alive = false;
      ac.abort();
    };
  }, [open, resetForm]);

  function showWarnings(warnings: unknown) {
    if (!Array.isArray(warnings)) return;
    for (const w of warnings) {
      if (typeof w === "string" && w.trim()) toast.warning(w);
    }
  }

  async function create() {
    if (!canManage) return;
    if (!locationId || !startsAtLocal) {
      toast.error(t("requiredFields"));
      return;
    }
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1) {
      toast.error(t("capacityInvalid"));
      return;
    }
    if (!stageId) {
      toast.error(t("stageRequired"));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_stage_id: stageId,
          location_id: locationId,
          instructor_id: instructorId || null,
          equipment_id: equipmentId || null,
          starts_at: fromLocalInputValue(startsAtLocal),
          capacity: cap,
          name: name.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t("saveFailed"));
      showWarnings(json.warnings);
      toast.success(t("createSuccess"));
      const createdId =
        typeof json.class?.id === "string" ? json.class.id : null;
      onOpenChange(false);
      if (createdId) onCreated(createdId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const stageLabel = (() => {
    if (!stageId) return null;
    const s = stages.find((row) => row.id === stageId);
    if (!s) return null;
    return s.template?.catalog_item?.name
      ? `${s.template.catalog_item.name} — ${s.name}`
      : `${s.template?.name ?? ""} — ${s.name}`;
  })();
  const locationLabel =
    locations.find((row) => row.id === locationId)?.name ?? null;
  const instructorLabel = instructorId
    ? (instructors.find((row) => row.id === instructorId)?.full_name ?? null)
    : t("instructorPlaceholder");
  const equipmentLabel = equipmentId
    ? (equipment.find((row) => row.id === equipmentId)?.name ?? null)
    : t("equipmentPlaceholder");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-border pr-12">
          <SheetTitle>{t("createTitle")}</SheetTitle>
          <SheetDescription>{t("createDescription")}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4">
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              {t("sectionSchedule")}
            </h3>

            <FieldBlock label={t("stage")}>
              <Select
                value={stageId}
                onValueChange={(v) => {
                  if (v) setStageId(v);
                }}
                disabled={!canManage}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("stagePlaceholder")}>
                    {stageLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.template?.catalog_item?.name
                        ? `${s.template.catalog_item.name} — ${s.name}`
                        : `${s.template?.name ?? ""} — ${s.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {stages.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("noStagesHint")}
                </p>
              ) : null}
            </FieldBlock>

            <FieldBlock label={t("startsAt")}>
              <DateTimePicker
                value={startsAtLocal}
                onChange={setStartsAtLocal}
                disabled={!canManage}
                placeholder={t("dateTimePlaceholder")}
                timeLabel={t("timeLabel")}
              />
            </FieldBlock>

            <FieldBlock label={t("location")}>
              <Select
                value={locationId}
                onValueChange={(v) => {
                  if (v) setLocationId(v);
                }}
                disabled={!canManage}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("locationPlaceholder")}>
                    {locationLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>

            <div className="grid grid-cols-2 gap-3">
              <FieldBlock label={t("capacity")}>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  disabled={!canManage}
                />
              </FieldBlock>
              <FieldBlock label={t("nameLabel")}>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  disabled={!canManage}
                />
              </FieldBlock>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              {t("sectionResources")}
            </h3>
            <FieldBlock label={t("instructor")}>
              <Select
                value={instructorId || "__none__"}
                onValueChange={(v) =>
                  setInstructorId(!v || v === "__none__" ? "" : v)
                }
                disabled={!canManage}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("instructorPlaceholder")}>
                    {instructorLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {t("instructorPlaceholder")}
                  </SelectItem>
                  {instructors.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
            <FieldBlock label={t("equipment")}>
              <Select
                value={equipmentId || "__none__"}
                onValueChange={(v) =>
                  setEquipmentId(!v || v === "__none__" ? "" : v)
                }
                disabled={!canManage}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("equipmentPlaceholder")}>
                    {equipmentLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {t("equipmentPlaceholder")}
                  </SelectItem>
                  {equipment.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
          </section>
        </div>

        {canManage ? (
          <SheetFooter className="shrink-0 border-t border-border">
            <Button
              type="button"
              className={cn("w-full sm:w-auto")}
              disabled={saving || stages.length === 0}
              onClick={() => void create()}
            >
              {saving ? <Loader2 className="animate-spin" /> : null}
              {t("create")}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
