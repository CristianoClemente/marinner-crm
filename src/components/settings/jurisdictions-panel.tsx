"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, MapPinned, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { effectiveJurisdictionEmail } from "@/lib/maritime/validate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { SettingsPanelHead } from "./settings-panel-head";
import { settingsType } from "./settings-type";

type Authority = {
  id: number;
  sigla: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  email: string | null;
};

type Member = { user_id: string; full_name: string; email: string };

type JurisdictionRow = {
  id: string;
  authority_id: number;
  responsible_user_id: string;
  email_override: string | null;
  is_default: boolean;
  authority: Authority | Authority[] | null;
  responsible:
    | { user_id: string; full_name: string; email: string }
    | { user_id: string; full_name: string; email: string }[]
    | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function authorityPlace(auth: Authority | null): string | null {
  if (!auth?.cidade) return null;
  return auth.uf ? `${auth.cidade}/${auth.uf}` : auth.cidade;
}

export function JurisdictionsPanel() {
  const t = useTranslations("Settings.jurisdictions");
  const { canEditSettings } = useAuth();
  const emailFieldId = useId();
  const defaultFieldId = useId();
  const responsibleFieldId = useId();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [rows, setRows] = useState<JurisdictionRow[]>([]);
  const [maxJurisdictions, setMaxJurisdictions] = useState<number | null>(1);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<JurisdictionRow | null>(null);
  const [removing, setRemoving] = useState<JurisdictionRow | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [authorityQ, setAuthorityQ] = useState("");
  const [authorityId, setAuthorityId] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [emailOverride, setEmailOverride] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [jRes, eRes] = await Promise.all([
        fetch("/api/account/jurisdictions"),
        fetch("/api/billing/subscription"),
      ]);
      const jBody = (await jRes.json()) as {
        jurisdictions?: JurisdictionRow[];
        error?: string;
      };
      if (!jRes.ok) throw new Error(jBody.error || t("loadError"));
      setRows(jBody.jurisdictions ?? []);

      if (eRes.ok) {
        const eBody = (await eRes.json()) as {
          entitlements?: { maxJurisdictions?: number | null };
        };
        setMaxJurisdictions(eBody.entitlements?.maxJurisdictions ?? 1);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  async function loadDialogData(q: string) {
    setDialogLoading(true);
    try {
      const [aRes, mRes] = await Promise.all([
        fetch(
          `/api/maritime-authorities${q ? `?q=${encodeURIComponent(q)}` : ""}`,
        ),
        fetch("/api/account/members"),
      ]);
      const aBody = (await aRes.json()) as { authorities?: Authority[] };
      const mBody = (await mRes.json()) as { members?: Member[] };
      if (aRes.ok) setAuthorities(aBody.authorities ?? []);
      if (mRes.ok) setMembers(mBody.members ?? []);
    } finally {
      setDialogLoading(false);
    }
  }

  function scheduleAuthoritySearch(q: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void loadDialogData(q);
    }, 280);
  }

  async function openCreate() {
    if (!canEditSettings) return;
    setEditing(null);
    setAuthorityId("");
    setResponsibleId("");
    setEmailOverride("");
    setIsDefault(rows.length === 0);
    setAuthorityQ("");
    setDialogOpen(true);
    await loadDialogData("");
  }

  async function openEdit(row: JurisdictionRow) {
    if (!canEditSettings) return;
    setEditing(row);
    setAuthorityId(String(row.authority_id));
    setResponsibleId(row.responsible_user_id);
    setEmailOverride(row.email_override ?? "");
    setIsDefault(row.is_default);
    setDialogOpen(true);
    await loadDialogData("");
  }

  const atLimit =
    maxJurisdictions !== null && rows.length >= maxJurisdictions;

  async function save() {
    if (!canEditSettings) return;
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/account/jurisdictions/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responsible_user_id: responsibleId,
            email_override: emailOverride || null,
            is_default: isDefault,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || t("saveError"));
        toast.success(t("saved"));
      } else {
        if (!authorityId || !responsibleId) {
          throw new Error(t("requiredFields"));
        }
        const res = await fetch("/api/account/jurisdictions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authority_id: Number(authorityId),
            responsible_user_id: responsibleId,
            email_override: emailOverride || null,
            is_default: isDefault,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || t("saveError"));
        toast.success(t("created"));
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!removing || !canEditSettings) return;
    setRemovingBusy(true);
    try {
      const res = await fetch(`/api/account/jurisdictions/${removing.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || t("removeError"));
      toast.success(t("removed"));
      setRemoving(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("removeError"));
    } finally {
      setRemovingBusy(false);
    }
  }

  const countLabel =
    maxJurisdictions === null
      ? t("countUnlimited", { used: rows.length })
      : t("count", { used: rows.length, max: maxJurisdictions });

  const editingAuth = editing ? one(editing.authority) : null;
  const removingAuth = removing ? one(removing.authority) : null;
  const canAdd = canEditSettings && !atLimit && !loading;
  const saveDisabled =
    saving ||
    !canEditSettings ||
    (!editing && (!authorityId || !responsibleId));

  const addButton = canEditSettings ? (
    <Button
      type="button"
      size="sm"
      aria-label={t("add")}
      className="size-9 p-0 sm:h-8 sm:w-auto sm:px-2.5"
      disabled={!canAdd}
      onClick={() => void openCreate()}
    >
      <Plus className="size-4" />
      <span className="hidden sm:inline">{t("add")}</span>
    </Button>
  ) : undefined;

  return (
    <section className="max-w-3xl animate-in fade-in-50 space-y-8 duration-200">
      <SettingsPanelHead
        className="mb-0"
        title={t("title")}
        description={t("description")}
        action={addButton}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className={settingsType.meta}>{countLabel}</p>
          {!canEditSettings ? (
            <p className={settingsType.meta}>{t("readOnly")}</p>
          ) : null}
        </div>

        {atLimit && canEditSettings ? (
          <p className={cn("rounded-lg bg-muted/40 px-3 py-2", settingsType.body)}>
            {t.rich("limitReached", {
              link: (chunks) => (
                <Link
                  href="/settings?tab=billing"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        ) : null}

        {loading ? (
          <div className={cn("flex items-center gap-2 py-8", settingsType.body)}>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("loading")}
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center px-4 py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-foreground/10">
                <MapPinned className="size-5" aria-hidden />
              </div>
              <p
                className={cn(
                  "mt-3 font-medium text-foreground",
                  settingsType.body,
                )}
              >
                {t("emptyTitle")}
              </p>
              <p className={cn("mt-1 max-w-[42ch]", settingsType.body)}>
                {canEditSettings ? t("emptyDesc") : t("emptyDescReadOnly")}
              </p>
              {canEditSettings ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-4 h-8"
                  disabled={atLimit}
                  onClick={() => void openCreate()}
                >
                  <Plus className="size-4" />
                  {t("add")}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card className="gap-0 py-0">
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {rows.map((row) => {
                  const auth = one(row.authority);
                  const resp = one(row.responsible);
                  const email = effectiveJurisdictionEmail(
                    row.email_override,
                    auth?.email,
                  );
                  const place = authorityPlace(auth);
                  return (
                    <li
                      key={row.id}
                      className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {auth?.sigla ?? row.authority_id}
                          </p>
                          {row.is_default ? (
                            <Badge
                              variant="outline"
                              className="border-primary/40 bg-primary/10 text-primary"
                            >
                              {t("default")}
                            </Badge>
                          ) : null}
                        </div>
                        {auth?.nome ? (
                          <p className="truncate text-sm text-muted-foreground">
                            {auth.nome}
                            {place ? (
                              <span className="text-muted-foreground/80">
                                {" "}
                                · {place}
                              </span>
                            ) : null}
                          </p>
                        ) : place ? (
                          <p className="text-sm text-muted-foreground">{place}</p>
                        ) : null}
                        <p className={settingsType.meta}>
                          {t("responsibleMeta", {
                            name: resp?.full_name || t("unnamed"),
                          })}
                          {email ? ` · ${email}` : ` · ${t("noEmail")}`}
                        </p>
                      </div>
                      {canEditSettings ? (
                        <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="relative size-9 after:absolute after:-inset-1 sm:after:hidden"
                            onClick={() => void openEdit(row)}
                            aria-label={t("edit")}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="relative size-9 text-destructive after:absolute after:-inset-1 hover:text-destructive sm:after:hidden"
                            onClick={() => setRemoving(row)}
                            aria-label={t("remove")}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("editTitle") : t("addTitle")}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? t("editDescription", {
                    sigla: editingAuth?.sigla ?? String(editing.authority_id),
                  })
                : t("addDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!editing ? (
              <div className="space-y-2">
                <Label htmlFor="jur-search">{t("searchAuthority")}</Label>
                <Input
                  id="jur-search"
                  value={authorityQ}
                  onChange={(e) => {
                    const q = e.target.value;
                    setAuthorityQ(q);
                    scheduleAuthoritySearch(q);
                  }}
                  placeholder={t("searchPlaceholder")}
                  autoComplete="off"
                />
                <Select
                  value={authorityId}
                  onValueChange={(v) => setAuthorityId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("pickAuthority")} />
                  </SelectTrigger>
                  <SelectContent>
                    {dialogLoading && authorities.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground">
                        {t("loading")}
                      </div>
                    ) : authorities.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground">
                        {t("noAuthorities")}
                      </div>
                    ) : (
                      authorities.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.sigla}
                          {a.cidade ? ` — ${a.cidade}/${a.uf}` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor={responsibleFieldId}>{t("responsible")}</Label>
              <Select
                value={responsibleId}
                onValueChange={(v) => setResponsibleId(v ?? "")}
              >
                <SelectTrigger id={responsibleFieldId} className="w-full">
                  <SelectValue placeholder={t("pickResponsible")} />
                </SelectTrigger>
                <SelectContent>
                  {dialogLoading && members.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      {t("loading")}
                    </div>
                  ) : members.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      {t("noMembers")}
                    </div>
                  ) : (
                    members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.full_name || m.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={emailFieldId}>{t("email")}</Label>
              <Input
                id={emailFieldId}
                type="email"
                value={emailOverride}
                onChange={(e) => setEmailOverride(e.target.value)}
                placeholder={t("emailPlaceholder")}
              />
              <p className="text-sm text-muted-foreground">
                {t("emailOverrideHint")}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2.5 ring-1 ring-foreground/5">
              <Label htmlFor={defaultFieldId} className="cursor-pointer">
                <span className="block text-sm font-medium text-foreground">
                  {t("setDefault")}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {t("setDefaultHint")}
                </span>
              </Label>
              <Switch
                id={defaultFieldId}
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-8"
              disabled={saving}
              onClick={() => setDialogOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="h-8"
              disabled={saveDisabled}
              aria-busy={saving}
              onClick={() => void save()}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("removeDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t.rich("removeDialogDesc", {
                sigla:
                  removingAuth?.sigla ??
                  (removing ? String(removing.authority_id) : ""),
                bold: (chunks) => (
                  <strong className="font-medium text-foreground">
                    {chunks}
                  </strong>
                ),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-8"
              disabled={removingBusy}
              onClick={() => setRemoving(null)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-8"
              disabled={removingBusy}
              aria-busy={removingBusy}
              onClick={() => void confirmRemove()}
            >
              {removingBusy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t("removing")}
                </>
              ) : (
                t("removeConfirm")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
