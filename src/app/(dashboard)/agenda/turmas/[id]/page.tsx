"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2, UserPlus, X } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import { useCan } from "@/hooks/use-can";
import type {
  ProcessClass,
  ProcessClassEnrollment,
  ProcessClassStatus,
} from "@/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  downloadGeneratedDocument,
  GenerateDocumentDialog,
  postGenerateDocument,
} from "@/components/documents/generate-document-dialog";

type LocationOpt = { id: string; name: string };
type InstructorOpt = { id: string; full_name: string };
type EquipmentOpt = { id: string; name: string };
type PoolItem = {
  id: string;
  contact?: { id: string; name: string | null; phone: string | null } | null;
};

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(local: string): string {
  return new Date(local).toISOString();
}

function ClassStatusBadge({ status }: { status: ProcessClassStatus }) {
  const t = useTranslations("Agenda");
  const label =
    status === "closed"
      ? t("statusClosed")
      : status === "canceled"
        ? t("statusCanceled")
        : t("statusOpen");
  return (
    <Badge
      variant={
        status === "canceled"
          ? "destructive"
          : status === "closed"
            ? "secondary"
            : "outline"
      }
    >
      {label}
    </Badge>
  );
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

export default function TurmaDetailPage() {
  const t = useTranslations("Agenda");
  const tDoc = useTranslations("Documents");
  const canManage = useCan("edit-settings");
  const router = useRouter();
  const params = useParams();
  const classId = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clazz, setClazz] = useState<ProcessClass | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [atestadoEnrollmentId, setAtestadoEnrollmentId] = useState<
    string | null
  >(null);

  const [locations, setLocations] = useState<LocationOpt[]>([]);
  const [instructors, setInstructors] = useState<InstructorOpt[]>([]);
  const [equipment, setEquipment] = useState<EquipmentOpt[]>([]);

  const [locationId, setLocationId] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [capacity, setCapacity] = useState("8");
  const [name, setName] = useState("");

  const [enrollments, setEnrollments] = useState<ProcessClassEnrollment[]>([]);
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [poolPick, setPoolPick] = useState("");

  const applyClassPayload = useCallback(
    (row: ProcessClass, eJson: { enrollments?: ProcessClassEnrollment[] }, pJson: { pool?: PoolItem[] }, eOk: boolean, pOk: boolean) => {
      setNotFound(false);
      setClazz(row);
      setLocationId(row.location_id);
      setInstructorId(row.instructor_id ?? "");
      setEquipmentId(row.equipment_id ?? "");
      setStartsAtLocal(toLocalInputValue(row.starts_at));
      setCapacity(String(row.capacity));
      setName(row.name ?? "");
      if (eOk) setEnrollments(eJson.enrollments ?? []);
      if (pOk) setPool(pJson.pool ?? []);
    },
    [],
  );

  const reloadClass = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const [cRes, eRes, pRes] = await Promise.all([
        fetch(`/api/classes/${classId}`),
        fetch(`/api/classes/${classId}/enrollments`),
        fetch(`/api/classes/${classId}/pool`),
      ]);
      const cJson = await cRes.json().catch(() => ({}));
      const eJson = await eRes.json().catch(() => ({}));
      const pJson = await pRes.json().catch(() => ({}));
      if (cRes.status === 404) {
        setNotFound(true);
        setClazz(null);
        return;
      }
      if (!cRes.ok) throw new Error(cJson.error || t("loadFailed"));
      applyClassPayload(
        cJson.class as ProcessClass,
        eJson,
        pJson,
        eRes.ok,
        pRes.ok,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [applyClassPayload, classId, t]);

  useEffect(() => {
    if (!classId) return;

    const ac = new AbortController();
    let alive = true;

    async function loadLookups() {
      try {
        const [locRes, instRes, eqRes] = await Promise.all([
          fetch("/api/class-locations?status=active", { signal: ac.signal }),
          fetch("/api/instructors?status=active", { signal: ac.signal }),
          fetch("/api/equipment?status=active", { signal: ac.signal }),
        ]);
        if (!alive) return;
        const locJson = await locRes.json().catch(() => ({}));
        const instJson = await instRes.json().catch(() => ({}));
        const eqJson = await eqRes.json().catch(() => ({}));
        if (!alive) return;
        if (locRes.ok) setLocations(locJson.locations ?? []);
        if (instRes.ok) setInstructors(instJson.instructors ?? []);
        if (eqRes.ok) setEquipment(eqJson.equipment ?? []);
      } catch {
        // Abort / navegação: não reportar
      }
    }

    async function loadClass() {
      setLoading(true);
      try {
        const [cRes, eRes, pRes] = await Promise.all([
          fetch(`/api/classes/${classId}`, { signal: ac.signal }),
          fetch(`/api/classes/${classId}/enrollments`, { signal: ac.signal }),
          fetch(`/api/classes/${classId}/pool`, { signal: ac.signal }),
        ]);
        if (!alive) return;
        const cJson = await cRes.json().catch(() => ({}));
        const eJson = await eRes.json().catch(() => ({}));
        const pJson = await pRes.json().catch(() => ({}));
        if (!alive) return;
        if (cRes.status === 404) {
          setNotFound(true);
          setClazz(null);
          return;
        }
        if (!cRes.ok) throw new Error(cJson.error || t("loadFailed"));
        applyClassPayload(
          cJson.class as ProcessClass,
          eJson,
          pJson,
          eRes.ok,
          pRes.ok,
        );
      } catch (err) {
        if (!alive || ac.signal.aborted) return;
        toast.error(err instanceof Error ? err.message : t("loadFailed"));
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadLookups();
    void loadClass();

    return () => {
      alive = false;
      ac.abort();
    };
  }, [applyClassPayload, classId, t]);

  function showWarnings(warnings: unknown) {
    if (!Array.isArray(warnings)) return;
    for (const w of warnings) {
      if (typeof w === "string" && w.trim()) toast.warning(w);
    }
  }

  async function save() {
    if (!canManage || !classId) return;
    if (!locationId || !startsAtLocal) {
      toast.error(t("requiredFields"));
      return;
    }
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1) {
      toast.error(t("capacityInvalid"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
      toast.success(t("saveSuccess"));
      await reloadClass();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: "closed" | "canceled" | "open") {
    if (!classId || !canManage) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t("saveFailed"));
      toast.success(
        status === "closed"
          ? t("closedSuccess")
          : status === "canceled"
            ? t("canceledSuccess")
            : t("reopenedSuccess"),
      );
      await reloadClass();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function generateAtestadosBatch() {
    if (!classId) return;
    setBatchBusy(true);
    try {
      const res = await fetch(`/api/classes/${classId}/documents/atestados`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tDoc("generateFailed"));
      const ok = Number(json.okCount ?? 0);
      const fail = Number(json.failCount ?? 0);
      if (fail > 0) {
        toast.warning(tDoc("batchPartial", { ok, fail }));
      } else {
        toast.success(tDoc("batchOk", { ok }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tDoc("generateFailed"));
      throw err;
    } finally {
      setBatchBusy(false);
    }
  }

  const atestadoGaps: string[] = [];
  if (!instructorId) atestadoGaps.push("Instrutor da turma");
  if (!locationId) atestadoGaps.push("Local da aula");
  if (enrollments.length === 0) atestadoGaps.push("Alunos alocados");

  async function enroll() {
    if (!classId || !poolPick || !canManage) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/classes/${classId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ process_id: poolPick }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t("enrollFailed"));
      toast.success(t("enrollSuccess"));
      setPoolPick("");
      await reloadClass();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("enrollFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function removeEnrollment(enrollmentId: string) {
    if (!classId || !canManage) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/classes/${classId}/enrollments?enrollment_id=${enrollmentId}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t("unenrollFailed"));
      toast.success(t("unenrollSuccess"));
      await reloadClass();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("unenrollFailed"));
    } finally {
      setSaving(false);
    }
  }

  const readOnly = !canManage || clazz?.status === "canceled";
  const title =
    name.trim() ||
    clazz?.template?.catalog_item?.name ||
    clazz?.template?.name ||
    t("editTitle");
  const agendaHref = clazz
    ? `/agenda?day=${clazz.starts_at.slice(0, 10)}`
    : "/agenda";

  const locationLabel =
    locations.find((row) => row.id === locationId)?.name ??
    clazz?.location?.name ??
    null;
  const instructorLabel = instructorId
    ? (instructors.find((row) => row.id === instructorId)?.full_name ??
      clazz?.instructor?.full_name ??
      null)
    : t("instructorPlaceholder");
  const equipmentLabel = equipmentId
    ? (equipment.find((row) => row.id === equipmentId)?.name ??
      clazz?.equipment?.name ??
      null)
    : t("equipmentPlaceholder");
  const poolLabel = (() => {
    if (!poolPick) return null;
    const p = pool.find((row) => row.id === poolPick);
    if (!p) return null;
    return p.contact?.name || p.contact?.phone || null;
  })();

  const metaBits = [
    clazz?.template_stage?.name,
    clazz ? formatDateTime(clazz.starts_at) : null,
    clazz?.location?.name,
  ].filter(Boolean);

  if (notFound) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <Button
          type="button"
          variant="ghost"
          className="w-fit"
          onClick={() => router.push("/agenda")}
        >
          <ArrowLeft data-icon="inline-start" />
          {t("backToAgenda")}
        </Button>
        <p className="text-sm text-muted-foreground">{t("turmaNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
      <header className="shrink-0 space-y-2">
        <Link
          href={agendaHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t("backToAgenda")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {loading && !clazz ? t("loading") : title}
          </h1>
          {clazz ? <ClassStatusBadge status={clazz.status} /> : null}
          {clazz ? (
            <span className="text-sm tabular-nums text-muted-foreground">
              {t("studentsCount", {
                count: enrollments.length,
                capacity: clazz.capacity,
              })}
            </span>
          ) : null}
        </div>
        {metaBits.length > 0 ? (
          <p className="truncate text-sm text-muted-foreground">
            {metaBits.join(" · ")}
          </p>
        ) : null}
      </header>

      {loading && !clazz ? (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-muted/60" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-muted/60" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-muted/60" />
          </div>
          <div className="hidden space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:block">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="h-9 w-full animate-pulse rounded-lg bg-muted/60" />
            <div className="h-9 w-full animate-pulse rounded-lg bg-muted/60" />
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          {/* Primary: roster */}
          <section className="flex min-h-0 flex-col rounded-xl bg-card ring-1 ring-foreground/10">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0 space-y-0.5">
                <h2 className="text-base font-medium text-foreground">
                  {t("students")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t("studentsHint")}
                </p>
              </div>
              {clazz ? (
                <p className="text-sm tabular-nums text-muted-foreground">
                  {t("studentsCount", {
                    count: enrollments.length,
                    capacity: clazz.capacity,
                  })}
                </p>
              ) : null}
            </div>

            {canManage && clazz?.status === "open" ? (
              <div className="space-y-2 border-b border-border px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={poolPick}
                    onValueChange={(v) => setPoolPick(v ?? "")}
                  >
                    <SelectTrigger className="min-w-0 flex-1">
                      <SelectValue placeholder={t("poolPlaceholder")}>
                        {poolLabel}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {pool.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.contact?.name ||
                            p.contact?.phone ||
                            p.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    disabled={!poolPick || saving}
                    onClick={() => void enroll()}
                  >
                    <UserPlus />
                    {t("enroll")}
                  </Button>
                </div>
                {pool.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("poolEmpty")}</p>
                ) : null}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {enrollments.length === 0 ? (
                <div className="flex flex-col items-start gap-1 px-4 py-10">
                  <p className="text-sm text-foreground">{t("noStudents")}</p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    {t("studentsHint")}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {enrollments.map((en, index) => {
                    const displayName =
                      en.process?.contact?.name ||
                      en.process?.contact?.phone ||
                      en.process_id;
                    const phone =
                      en.process?.contact?.name && en.process?.contact?.phone
                        ? en.process.contact.phone
                        : null;
                    return (
                      <li
                        key={en.id}
                        className="flex items-center gap-3 px-4 py-3.5"
                      >
                        <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {displayName}
                          </p>
                          {phone ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {phone}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {canManage && clazz?.status !== "canceled" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={atestadoGaps.length > 0}
                              onClick={() => setAtestadoEnrollmentId(en.id)}
                            >
                              {tDoc("atestado")}
                            </Button>
                          ) : null}
                          {canManage && clazz?.status === "open" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className={cn(
                                "text-muted-foreground hover:text-destructive",
                              )}
                              disabled={saving}
                              aria-label={t("unenroll")}
                              onClick={() => void removeEnrollment(en.id)}
                            >
                              <Trash2 />
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* Secondary: class meta */}
          <aside className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:sticky lg:top-4">
            <h2 className="text-sm font-medium text-foreground">
              {t("classDetails")}
            </h2>

            <section className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground">
                {t("sectionSchedule")}
              </h3>
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium text-foreground">
                  {clazz?.template?.catalog_item?.name ??
                    clazz?.template?.name ??
                    "—"}
                </p>
                <p className="text-muted-foreground">
                  {clazz?.template_stage?.name}
                </p>
              </div>
              <FieldBlock label={t("startsAt")}>
                <DateTimePicker
                  value={startsAtLocal}
                  onChange={setStartsAtLocal}
                  disabled={readOnly}
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
                  disabled={readOnly}
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
                    disabled={readOnly}
                  />
                </FieldBlock>
                <FieldBlock label={t("nameLabel")}>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                    disabled={readOnly}
                  />
                </FieldBlock>
              </div>
            </section>

            <section className="space-y-3 border-t border-border pt-4">
              <h3 className="text-xs font-medium text-muted-foreground">
                {t("sectionResources")}
              </h3>
              <FieldBlock label={t("instructor")}>
                <Select
                  value={instructorId || "__none__"}
                  onValueChange={(v) =>
                    setInstructorId(!v || v === "__none__" ? "" : v)
                  }
                  disabled={readOnly}
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
                  disabled={readOnly}
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

            {canManage && !readOnly ? (
              <Button
                type="button"
                className="w-full"
                disabled={saving || loading}
                onClick={() => void save()}
              >
                {saving ? <Loader2 className="animate-spin" /> : null}
                {t("save")}
              </Button>
            ) : null}

            {canManage && clazz?.status === "open" ? (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={saving || batchBusy}
                  onClick={() => setCloseDialogOpen(true)}
                >
                  {t("close")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={saving}
                  onClick={() => void setStatus("canceled")}
                >
                  <X />
                  {t("cancelClass")}
                </Button>
              </div>
            ) : null}

            {canManage && clazz?.status === "closed" ? (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  className="w-full"
                  disabled={batchBusy || atestadoGaps.length > 0}
                  onClick={() => void generateAtestadosBatch()}
                >
                  {batchBusy ? <Loader2 className="animate-spin" /> : null}
                  {tDoc("atestadosBatch")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={saving}
                  onClick={() => void setStatus("open")}
                >
                  {t("reopen")}
                </Button>
              </div>
            ) : null}
          </aside>
        </div>
      )}

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tDoc("closeGenerateTitle")}</DialogTitle>
            <DialogDescription>{tDoc("closeGenerateDesc")}</DialogDescription>
          </DialogHeader>
          {atestadoGaps.length > 0 ? (
            <ul className="list-inside list-disc text-sm text-destructive">
              {atestadoGaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-muted-foreground">{tDoc("disclaimer")}</p>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              disabled={batchBusy || saving || atestadoGaps.length > 0}
              onClick={() => {
                void (async () => {
                  await generateAtestadosBatch();
                  await setStatus("closed");
                  setCloseDialogOpen(false);
                })();
              }}
            >
              {batchBusy || saving ? (
                <Loader2 className="animate-spin" />
              ) : null}
              {tDoc("closeAndGenerate")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={batchBusy || saving}
              onClick={() => {
                void (async () => {
                  await setStatus("closed");
                  setCloseDialogOpen(false);
                })();
              }}
            >
              {tDoc("closeOnly")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GenerateDocumentDialog
        open={Boolean(atestadoEnrollmentId)}
        onOpenChange={(open) => {
          if (!open) setAtestadoEnrollmentId(null);
        }}
        title={tDoc("atestado")}
        mode="atestado"
        gaps={atestadoGaps}
        summaryLines={
          clazz
            ? [
                formatDateTime(clazz.starts_at),
                instructors.find((i) => i.id === instructorId)?.full_name ?? "",
              ].filter(Boolean)
            : []
        }
        onGenerate={async (extra) => {
          if (!atestadoEnrollmentId || !classId) return;
          const doc = await postGenerateDocument({
            kind: "atestado_arrais",
            classId,
            enrollmentId: atestadoEnrollmentId,
            trainingHoursLabel: extra.trainingHoursLabel,
          });
          toast.success(tDoc("generateSuccess"));
          await downloadGeneratedDocument(doc.id);
        }}
      />
    </div>
  );
}
