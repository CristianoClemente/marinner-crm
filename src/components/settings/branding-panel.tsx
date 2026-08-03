"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Link2,
  Trash2,
  Upload,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/hooks/use-auth";
import { getTenantUrl } from "@/lib/domain";
import { DEFAULT_LOGO_SRC } from "@/lib/brand";
import { normalizeSlug, validateSlug } from "@/lib/account/slug";
import { uploadAccountMedia } from "@/lib/storage/upload-media";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingsFormFooter } from "./settings-form-footer";
import { SettingsScopeChip } from "./settings-scope-chip";
import { settingsType } from "./settings-type";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const BRANDING_BUCKET = "account-branding";

/**
 * Marca da escola — nome, logo e slug.
 * Persistência via PATCH /api/account. Upload no bucket account-branding.
 * Somente admin+ edita; demais membros veem somente leitura.
 */
export function BrandingPanel() {
  const t = useTranslations("Settings.branding");
  const { account, canEditSettings, refreshProfile, profileLoading } =
    useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!account || seeded) return;
    setName(account.name ?? "");
    setSlug(account.slug ?? "");
    setLogoUrl(account.logo_url ?? null);
    setSeeded(true);
  }, [account, seeded]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const displayLogo = previewUrl ?? (!removeLogo ? logoUrl : null);

  const dirty = useMemo(() => {
    if (!account || !seeded) return false;
    const nameChanged = name.trim() !== (account.name ?? "").trim();
    const slugChanged = slug.trim() !== (account.slug ?? "").trim();
    return nameChanged || slugChanged || Boolean(pendingLogo) || removeLogo;
  }, [account, seeded, name, slug, pendingLogo, removeLogo]);

  const slugPreview = (() => {
    const result = validateSlug(slug || "");
    if (!result.ok) return null;
    return getTenantUrl(result.slug);
  })();

  const discard = () => {
    if (!account) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setName(account.name ?? "");
    setSlug(account.slug ?? "");
    setLogoUrl(account.logo_url ?? null);
    setPendingLogo(null);
    setPreviewUrl(null);
    setRemoveLogo(false);
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_MIME.has(file.type)) {
      toast.error(t("unsupportedImage"));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(t("imageTooLarge"));
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingLogo(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemoveLogo(false);
  };

  const onRemoveLogo = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingLogo(null);
    setPreviewUrl(null);
    setRemoveLogo(true);
  };

  const onSlugChange = (value: string) => {
    setSlug(value.toLowerCase().replace(/\s+/g, "-"));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSettings || !account) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error(t("nameRequired"));
      return;
    }

    let nextSlug: string | null = null;
    const rawSlug = slug.trim();
    if (rawSlug) {
      const result = validateSlug(rawSlug);
      if (!result.ok) {
        const key =
          result.error === "reserved"
            ? "slugReserved"
            : result.error === "too_short"
              ? "slugTooShort"
              : result.error === "too_long"
                ? "slugTooLong"
                : "slugInvalid";
        toast.error(t(key));
        return;
      }
      nextSlug = result.slug;
      setSlug(result.slug);
    }

    setSaving(true);
    try {
      let nextLogoUrl: string | null = logoUrl;

      if (pendingLogo) {
        const { publicUrl } = await uploadAccountMedia(
          BRANDING_BUCKET,
          pendingLogo,
        );
        nextLogoUrl = publicUrl;
      } else if (removeLogo) {
        nextLogoUrl = null;
      }

      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          slug: nextSlug,
          logo_url: nextLogoUrl,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: string;
        account?: { name: string; slug: string | null; logo_url: string | null };
      } | null;

      if (!res.ok) {
        throw new Error(json?.error ?? t("saveFailed"));
      }

      setLogoUrl(json?.account?.logo_url ?? nextLogoUrl);
      setPendingLogo(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setRemoveLogo(false);
      await refreshProfile();
      toast.success(t("saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (profileLoading && !account) {
    return (
      <Card>
        <CardContent className={cn("py-8", settingsType.body)}>
          {t("loading")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className={cn("flex items-center gap-2", settingsType.sectionTitle)}>
            <Building2 className="size-4 text-primary" aria-hidden />
            {t("title")}
          </CardTitle>
          <SettingsScopeChip scope="account" />
        </div>
        <CardDescription className={settingsType.body}>
          {t("description")}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form id="branding-form" onSubmit={onSubmit} className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div
              className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted"
              aria-hidden
            >
              {displayLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayLogo}
                  alt=""
                  className="size-full object-contain p-1"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={DEFAULT_LOGO_SRC}
                  alt=""
                  className="size-full object-contain p-1"
                />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Label>{t("logo")}</Label>
              <p className={settingsType.meta}>{t("logoHint")}</p>
              {canEditSettings && (
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={onPickFile}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 sm:min-h-8"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-4" />
                    {t("uploadLogo")}
                  </Button>
                  {displayLogo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-11 text-destructive sm:min-h-8"
                      onClick={onRemoveLogo}
                    >
                      <Trash2 className="size-4" />
                      {t("removeLogo")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="school-name">{t("name")}</Label>
            <Input
              id="school-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEditSettings || saving}
              maxLength={80}
              className="h-11 text-base md:h-9 md:text-sm"
              autoComplete="organization"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="school-slug">{t("slug")}</Label>
            <Input
              id="school-slug"
              value={slug}
              onChange={(e) => onSlugChange(e.target.value)}
              onBlur={() => {
                if (slug.trim()) setSlug(normalizeSlug(slug));
              }}
              disabled={!canEditSettings || saving}
              placeholder={t("slugPlaceholder")}
              className="h-11 font-mono text-base md:h-9 md:text-sm"
              autoComplete="off"
              spellCheck={false}
            />
            <p className={settingsType.meta}>{t("slugHint")}</p>
            {slugPreview && (
              <p className="flex items-start gap-1.5 text-sm text-foreground">
                <Link2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 break-all">{slugPreview}</span>
              </p>
            )}
          </div>
        </form>
      </CardContent>

      {canEditSettings ? (
        <SettingsFormFooter
          formId="branding-form"
          dirty={dirty}
          saving={saving}
          onDiscard={discard}
          saveLabel={t("save")}
          savingLabel={t("saving")}
        />
      ) : (
        <CardFooter className="border-t border-border">
          <p className={settingsType.body}>{t("adminOnly")}</p>
        </CardFooter>
      )}
    </Card>
  );
}
