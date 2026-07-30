"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Loader2, Link2, Mail } from "lucide-react";
import { toast } from "sonner";

import { CHA_CATEGORIES } from "@/lib/instructors/validate";
import type {
  ChaCategory,
  ClassLocation,
  Instructor,
  InstructorStatus,
} from "@/types";
import type { AccountMember } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const FORM_ID = "instructor-form";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

interface InstructorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instructor: Instructor | null;
  onSaved: () => void;
}

export function InstructorForm({
  open,
  onOpenChange,
  instructor,
  onSaved,
}: InstructorFormProps) {
  const t = useTranslations("Instructors.form");
  const isEdit = !!instructor;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [chaNumber, setChaNumber] = useState("");
  const [chaCategory, setChaCategory] = useState<ChaCategory>("mta");
  const [chaExpires, setChaExpires] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [status, setStatus] = useState<InstructorStatus>("active");
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [locations, setLocations] = useState<ClassLocation[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingExtras, setLoadingExtras] = useState(false);

  const [members, setMembers] = useState<AccountMember[]>([]);
  const [linkUserId, setLinkUserId] = useState("");
  const [linking, setLinking] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const resetCreate = useCallback(() => {
    setFullName("");
    setPhone("");
    setBirthDate("");
    setChaNumber("");
    setChaCategory("mta");
    setChaExpires("");
    setPixKey("");
    setStatus("active");
    setLocationIds([]);
    setWeekdays([]);
    setLinkUserId("");
    setInviteUrl(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/class-locations?status=active");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("locationsLoadError"));
        if (!cancelled) setLocations(data.locations ?? []);
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : t("locationsLoadError"),
          );
          setLocations([]);
        }
      }
    })();

    if (instructor) {
      setFullName(instructor.full_name);
      setPhone(instructor.phone);
      setBirthDate(instructor.birth_date);
      setChaNumber(instructor.cha_number);
      setChaCategory(instructor.cha_category);
      setChaExpires(instructor.cha_expires_on);
      setPixKey(instructor.pix_key);
      setStatus(instructor.status);
      setInviteUrl(null);
      setLinkUserId("");
      setLoadingExtras(true);

      void (async () => {
        try {
          const [locRes, weekRes, memRes] = await Promise.all([
            fetch(`/api/instructors/${instructor.id}/locations`),
            fetch(`/api/instructors/${instructor.id}/weekly`),
            fetch("/api/account/members"),
          ]);
          const locData = await locRes.json();
          const weekData = await weekRes.json();
          const memData = await memRes.json();
          if (!locRes.ok) throw new Error(locData.error || t("extrasLoadError"));
          if (!weekRes.ok)
            throw new Error(weekData.error || t("extrasLoadError"));
          if (!cancelled) {
            setLocationIds(
              (locData.locations ?? [])
                .filter((l: { active: boolean }) => l.active)
                .map((l: { location_id: string }) => l.location_id),
            );
            setWeekdays(
              (weekData.weekly ?? [])
                .filter((w: { active: boolean }) => w.active)
                .map((w: { weekday: number }) => w.weekday),
            );
            setMembers(memData.members ?? []);
          }
        } catch (err) {
          if (!cancelled) {
            toast.error(
              err instanceof Error ? err.message : t("extrasLoadError"),
            );
          }
        } finally {
          if (!cancelled) setLoadingExtras(false);
        }
      })();
    } else {
      resetCreate();
      setLoadingExtras(false);
    }

    return () => {
      cancelled = true;
    };
  }, [open, instructor, resetCreate, t]);

  function toggleLocation(id: string) {
    setLocationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleWeekday(day: number) {
    setWeekdays((prev) =>
      prev.includes(day)
        ? prev.filter((x) => x !== day)
        : [...prev, day].sort((a, b) => a - b),
    );
  }

  async function saveExtras(id: string) {
    const [locRes, weekRes] = await Promise.all([
      fetch(`/api/instructors/${id}/locations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location_ids: locationIds }),
      }),
      fetch(`/api/instructors/${id}/weekly`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekdays }),
      }),
    ]);
    const locData = await locRes.json();
    const weekData = await weekRes.json();
    if (!locRes.ok) throw new Error(locData.error || t("saveError"));
    if (!weekRes.ok) throw new Error(weekData.error || t("saveError"));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        full_name: fullName,
        phone,
        birth_date: birthDate,
        cha_number: chaNumber,
        cha_category: chaCategory,
        cha_expires_on: chaExpires,
        pix_key: pixKey,
        status,
      };

      let id = instructor?.id;
      if (isEdit && id) {
        const res = await fetch(`/api/instructors/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("saveError"));
      } else {
        const res = await fetch("/api/instructors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("saveError"));
        id = data.instructor.id as string;
      }

      if (!id) throw new Error(t("saveError"));
      await saveExtras(id);
      toast.success(isEdit ? t("saved") : t("created"));
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleInvite() {
    if (!instructor) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/instructors/${instructor.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("inviteError"));
      setInviteUrl(data.url as string);
      toast.success(t("inviteCreated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("inviteError"));
    } finally {
      setInviting(false);
    }
  }

  async function handleLink() {
    if (!instructor || !linkUserId) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/instructors/${instructor.id}/link-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: linkUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("linkError"));
      toast.success(t("linked"));
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("linkError"));
    } finally {
      setLinking(false);
    }
  }

  const linkableMembers = members.filter(
    (m) => m.role === "instructor" && m.user_id !== instructor?.user_id,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle>
            {isEdit ? t("editTitle") : t("createTitle")}
          </DialogTitle>
        </DialogHeader>

        <form
          id={FORM_ID}
          onSubmit={(e) => void handleSubmit(e)}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="inst-name">{t("fullName")}</Label>
              <Input
                id="inst-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inst-phone">{t("phone")}</Label>
              <Input
                id="inst-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inst-birth">{t("birthDate")}</Label>
              <Input
                id="inst-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inst-cha-num">{t("chaNumber")}</Label>
              <Input
                id="inst-cha-num"
                value={chaNumber}
                onChange={(e) => setChaNumber(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("chaCategory")}</Label>
              <Select
                value={chaCategory}
                onValueChange={(v) => v && setChaCategory(v as ChaCategory)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHA_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`cha.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inst-cha-exp">{t("chaExpires")}</Label>
              <Input
                id="inst-cha-exp"
                type="date"
                value={chaExpires}
                onChange={(e) => setChaExpires(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inst-pix">{t("pixKey")}</Label>
              <Input
                id="inst-pix"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("status")}</Label>
              <Select
                value={status}
                onValueChange={(v) => v && setStatus(v as InstructorStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("statusActive")}</SelectItem>
                  <SelectItem value="inactive">{t("statusInactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("locations")}</Label>
            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noLocations")}
              </p>
            ) : (
              <div className="max-h-36 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                {locations.map((loc) => (
                  <label
                    key={loc.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={locationIds.includes(loc.id)}
                      onCheckedChange={() => toggleLocation(loc.id)}
                    />
                    {loc.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("weekdays")}</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <label
                  key={d}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 text-sm"
                >
                  <Checkbox
                    checked={weekdays.includes(d)}
                    onCheckedChange={() => toggleWeekday(d)}
                  />
                  {t(`weekday.${d}`)}
                </label>
              ))}
            </div>
          </div>

          {isEdit && !loadingExtras && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground">
                {t("loginSection")}
              </p>
              {instructor?.user_id ? (
                <p className="text-sm text-muted-foreground">
                  {t("alreadyLinked")}
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    {t("linkHint")}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={inviting}
                      onClick={() => void handleInvite()}
                      className="sm:flex-1"
                    >
                      {inviting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Mail className="size-4" />
                      )}
                      {t("invite")}
                    </Button>
                  </div>
                  {inviteUrl && (
                    <div className="flex items-center gap-2">
                      <Input readOnly value={inviteUrl} className="text-xs" />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t("copyInvite")}
                        onClick={() => {
                          void navigator.clipboard.writeText(inviteUrl);
                          toast.success(t("inviteCopied"));
                        }}
                      >
                        <Copy className="size-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Label>{t("linkUser")}</Label>
                      <Select
                        value={linkUserId || undefined}
                        onValueChange={(v) => v && setLinkUserId(v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("linkUserPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {linkableMembers.map((m) => (
                              <SelectItem key={m.user_id} value={m.user_id}>
                                {m.full_name || m.email || m.user_id}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!linkUserId || linking}
                      onClick={() => void handleLink()}
                    >
                      {linking ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Link2 className="size-4" />
                      )}
                      {t("link")}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </form>

        <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
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
  );
}
