"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { formatCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { meterUnitForKind } from "@/lib/equipment/validate";
import type {
  EngineCycle,
  Equipment,
  EquipmentFuel,
  EquipmentKind,
  EquipmentMaintenance,
  EquipmentStatus,
  EquipmentSubtype,
  MaintenanceKind,
  MaintenanceStatus,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const FORM_ID = "equipment-form";

const FUELS: EquipmentFuel[] = [
  "gasoline",
  "ethanol",
  "flex",
  "diesel",
  "electric",
];

interface EquipmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
  onSaved: () => void;
}

export function EquipmentForm({
  open,
  onOpenChange,
  equipment,
  onSaved,
}: EquipmentFormProps) {
  const t = useTranslations("Equipment.form");
  const isEdit = !!equipment;

  const [name, setName] = useState("");
  const [kind, setKind] = useState<EquipmentKind>("vessel");
  const [subtype, setSubtype] = useState<EquipmentSubtype>("boat");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [engineCycle, setEngineCycle] = useState<EngineCycle | "">("4t");
  const [fuel, setFuel] = useState<EquipmentFuel>("gasoline");
  const [meterValue, setMeterValue] = useState("0");
  const [documentExpires, setDocumentExpires] = useState("");
  const [plate, setPlate] = useState("");
  const [dpemExpires, setDpemExpires] = useState("");
  const [dpemProtocol, setDpemProtocol] = useState("");
  const [status, setStatus] = useState<EquipmentStatus>("active");
  const [saving, setSaving] = useState(false);

  const [maintenances, setMaintenances] = useState<EquipmentMaintenance[]>([]);
  const [maintLoading, setMaintLoading] = useState(false);
  const [maintKind, setMaintKind] = useState<MaintenanceKind>("preventive");
  const [maintStatus, setMaintStatus] =
    useState<MaintenanceStatus>("completed");
  const [maintDate, setMaintDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [maintDesc, setMaintDesc] = useState("");
  const [maintMeter, setMaintMeter] = useState("");
  const [maintCost, setMaintCost] = useState("");
  const [maintVendor, setMaintVendor] = useState("");
  const [maintNextDue, setMaintNextDue] = useState("");
  const [addingMaint, setAddingMaint] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (equipment) {
      setName(equipment.name);
      setKind(equipment.kind);
      setSubtype(equipment.subtype);
      setBrand(equipment.brand);
      setModel(equipment.model);
      setEngineCycle(equipment.engine_cycle ?? "");
      setFuel(equipment.fuel);
      setMeterValue(String(equipment.meter_value));
      setDocumentExpires(equipment.document_expires_on);
      setPlate(equipment.plate_or_registration);
      setDpemExpires(equipment.dpem_expires_on ?? "");
      setDpemProtocol(equipment.dpem_protocol ?? "");
      setStatus(equipment.status);
      setMaintLoading(true);
      let cancelled = false;
      void (async () => {
        try {
          const res = await fetch(
            `/api/equipment/${equipment.id}/maintenances`,
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || t("maintLoadError"));
          if (!cancelled) setMaintenances(data.maintenances ?? []);
        } catch (err) {
          if (!cancelled) {
            toast.error(
              err instanceof Error ? err.message : t("maintLoadError"),
            );
            setMaintenances([]);
          }
        } finally {
          if (!cancelled) setMaintLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    setName("");
    setKind("vessel");
    setSubtype("boat");
    setBrand("");
    setModel("");
    setEngineCycle("4t");
    setFuel("gasoline");
    setMeterValue("0");
    setDocumentExpires("");
    setPlate("");
    setDpemExpires("");
    setDpemProtocol("");
    setStatus("active");
    setMaintenances([]);
  }, [open, equipment, t]);

  function onKindChange(next: EquipmentKind) {
    setKind(next);
    setSubtype(next === "vehicle" ? "car" : "boat");
    if (next === "vehicle") {
      setDpemExpires("");
      setDpemProtocol("");
      setEngineCycle("");
    } else if (!engineCycle) {
      setEngineCycle("4t");
    }
  }

  function subtypeOptions(k: EquipmentKind): EquipmentSubtype[] {
    return k === "vehicle" ? ["car", "motorcycle"] : ["jet_ski", "boat"];
  }

  function labelSubtype(s: EquipmentSubtype) {
    return t(`subtype.${s}`);
  }

  function labelFuel(f: EquipmentFuel) {
    return t(`fuel.${f}`);
  }

  function labelStatus(s: EquipmentStatus) {
    return t(`status.${s}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        kind,
        subtype,
        brand,
        model,
        engine_cycle:
          subtype === "car" || !engineCycle ? null : engineCycle,
        fuel,
        meter_value: Number(meterValue),
        meter_unit: meterUnitForKind(kind),
        document_expires_on: documentExpires,
        plate_or_registration: plate,
        dpem_expires_on: kind === "vessel" ? dpemExpires || null : null,
        dpem_protocol: kind === "vessel" ? dpemProtocol || null : null,
        status,
      };

      if (isEdit && equipment) {
        const res = await fetch(`/api/equipment/${equipment.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("saveError"));
        toast.success(t("saved"));
      } else {
        const res = await fetch("/api/equipment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("saveError"));
        toast.success(t("created"));
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function addMaintenance() {
    if (!equipment) return;
    setAddingMaint(true);
    try {
      const res = await fetch(`/api/equipment/${equipment.id}/maintenances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: maintKind,
          status: maintStatus,
          performed_on: maintDate,
          description: maintDesc,
          meter_value_at: maintMeter ? Number(maintMeter) : null,
          cost: maintCost ? Number(maintCost) : null,
          vendor: maintVendor || null,
          next_due_on: maintNextDue || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("maintSaveError"));
      toast.success(t("maintCreated"));
      setMaintDesc("");
      setMaintMeter("");
      setMaintCost("");
      setMaintVendor("");
      setMaintNextDue("");
      const list = await fetch(`/api/equipment/${equipment.id}/maintenances`);
      const listData = await list.json();
      if (list.ok) setMaintenances(listData.maintenances ?? []);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("maintSaveError"));
    } finally {
      setAddingMaint(false);
    }
  }

  const meterUnit = meterUnitForKind(kind);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editTitle") : t("createTitle")}
          </DialogTitle>
        </DialogHeader>

        <form
          id={FORM_ID}
          onSubmit={(e) => void handleSubmit(e)}
          className="max-h-[60dvh] space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain"
        >
          <div className="space-y-1.5">
            <Label htmlFor="eq-name">{t("name")}</Label>
            <Input
              id="eq-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="text-base md:text-sm"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("kind")}</Label>
              <Select
                value={kind}
                onValueChange={(v) =>
                  onKindChange((v as EquipmentKind) ?? "vessel")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {kind === "vehicle" ? t("kindVehicle") : t("kindVessel")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vehicle">{t("kindVehicle")}</SelectItem>
                  <SelectItem value="vessel">{t("kindVessel")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("subtypeLabel")}</Label>
              <Select
                value={subtype}
                onValueChange={(v) =>
                  setSubtype((v as EquipmentSubtype) ?? subtype)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{labelSubtype(subtype)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {subtypeOptions(kind).map((s) => (
                    <SelectItem key={s} value={s}>
                      {labelSubtype(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eq-brand">{t("brand")}</Label>
              <Input
                id="eq-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                required
                className="text-base md:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-model">{t("model")}</Label>
              <Input
                id="eq-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                required
                className="text-base md:text-sm"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("fuelLabel")}</Label>
              <Select
                value={fuel}
                onValueChange={(v) =>
                  setFuel((v as EquipmentFuel) ?? "gasoline")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{labelFuel(fuel)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FUELS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {labelFuel(f)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {subtype !== "car" && (
              <div className="space-y-1.5">
                <Label>{t("engineCycle")}</Label>
                <Select
                  value={engineCycle || "none"}
                  onValueChange={(v) =>
                    setEngineCycle(
                      !v || v === "none" ? "" : (v as EngineCycle),
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {engineCycle
                        ? t(`engine.${engineCycle}`)
                        : t("engineNone")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("engineNone")}</SelectItem>
                    <SelectItem value="2t">{t("engine.2t")}</SelectItem>
                    <SelectItem value="4t">{t("engine.4t")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eq-meter">
                {t("meter")} ({meterUnit === "km" ? t("unitKm") : t("unitHours")})
              </Label>
              <Input
                id="eq-meter"
                value={meterValue}
                onChange={(e) => setMeterValue(e.target.value)}
                className="text-base tabular-nums md:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-plate">
                {kind === "vehicle" ? t("plate") : t("registration")}
              </Label>
              <Input
                id="eq-plate"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                required
                className="text-base md:text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="eq-doc">{t("documentExpires")}</Label>
            <Input
              id="eq-doc"
              type="date"
              value={documentExpires}
              onChange={(e) => setDocumentExpires(e.target.value)}
              required
              className="text-base md:text-sm"
            />
          </div>

          {kind === "vessel" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="eq-dpem-exp">{t("dpemExpires")}</Label>
                <Input
                  id="eq-dpem-exp"
                  type="date"
                  value={dpemExpires}
                  onChange={(e) => setDpemExpires(e.target.value)}
                  required
                  className="text-base md:text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eq-dpem-prot">{t("dpemProtocol")}</Label>
                <Input
                  id="eq-dpem-prot"
                  value={dpemProtocol}
                  onChange={(e) => setDpemProtocol(e.target.value)}
                  required
                  className="text-base md:text-sm"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t("statusLabel")}</Label>
            <Select
              value={status}
              onValueChange={(v) =>
                setStatus((v as EquipmentStatus) ?? "active")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue>{labelStatus(status)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(
                  [
                    "active",
                    "in_maintenance",
                    "inactive",
                    "decommissioned",
                  ] as const
                ).map((s) => (
                  <SelectItem key={s} value={s}>
                    {labelStatus(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isEdit && equipment && (
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">
                {t("maintTitle")}
              </p>
              {maintLoading ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {maintenances.length === 0 ? (
                    <li className="px-3 py-2.5 text-sm text-muted-foreground">
                      {t("maintEmpty")}
                    </li>
                  ) : (
                    maintenances.slice(0, 8).map((m) => (
                      <li key={m.id} className="px-3 py-2 text-sm">
                        <p className="text-foreground">
                          {t(`maintKind.${m.kind}`)} ·{" "}
                          {formatDate(m.performed_on)} ·{" "}
                          {t(`maintStatus.${m.status}`)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.description}
                          {m.cost != null
                            ? ` · ${formatCurrency(m.cost)}`
                            : ""}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("maintKindLabel")}</Label>
                  <Select
                    value={maintKind}
                    onValueChange={(v) =>
                      setMaintKind((v as MaintenanceKind) ?? "preventive")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {t(`maintKind.${maintKind}`)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preventive">
                        {t("maintKind.preventive")}
                      </SelectItem>
                      <SelectItem value="corrective">
                        {t("maintKind.corrective")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("maintStatusLabel")}</Label>
                  <Select
                    value={maintStatus}
                    onValueChange={(v) =>
                      setMaintStatus((v as MaintenanceStatus) ?? "completed")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {t(`maintStatus.${maintStatus}`)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        [
                          "scheduled",
                          "in_progress",
                          "completed",
                          "cancelled",
                        ] as const
                      ).map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`maintStatus.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maint-date">{t("maintDate")}</Label>
                  <Input
                    id="maint-date"
                    type="date"
                    value={maintDate}
                    onChange={(e) => setMaintDate(e.target.value)}
                    className="text-base md:text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maint-next">{t("maintNextDue")}</Label>
                  <Input
                    id="maint-next"
                    type="date"
                    value={maintNextDue}
                    onChange={(e) => setMaintNextDue(e.target.value)}
                    className="text-base md:text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maint-desc">{t("maintDesc")}</Label>
                <Textarea
                  id="maint-desc"
                  value={maintDesc}
                  onChange={(e) => setMaintDesc(e.target.value)}
                  rows={2}
                  className="text-base md:text-sm"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="maint-meter">{t("maintMeter")}</Label>
                  <Input
                    id="maint-meter"
                    value={maintMeter}
                    onChange={(e) => setMaintMeter(e.target.value)}
                    className="text-base tabular-nums md:text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maint-cost">{t("maintCost")}</Label>
                  <Input
                    id="maint-cost"
                    value={maintCost}
                    onChange={(e) => setMaintCost(e.target.value)}
                    className="text-base tabular-nums md:text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maint-vendor">{t("maintVendor")}</Label>
                  <Input
                    id="maint-vendor"
                    value={maintVendor}
                    onChange={(e) => setMaintVendor(e.target.value)}
                    className="text-base md:text-sm"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={addingMaint || !maintDesc.trim()}
                onClick={() => void addMaintenance()}
              >
                {addingMaint ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {t("maintAdd")}
              </Button>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
