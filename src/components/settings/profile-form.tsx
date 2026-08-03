'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, Trash2, Mail, CircleAlert } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { uploadAccountMedia } from '@/lib/storage/upload-media';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SettingsFormFooter } from './settings-form-footer';
import { SettingsPanelHead } from './settings-panel-head';
import { SettingsScopeChip } from './settings-scope-chip';
import { settingsType } from './settings-type';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

// Rough email shape check — the real validator is Supabase Auth, which
// rejects anything malformed when we call updateUser({ email }). We
// just want to stop obvious typos before making a network call.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProfileForm() {
  const t = useTranslations('Settings.profile');
  const { user, profile, refreshProfile } = useAuth();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailChangePending, setEmailChangePending] = useState(false);

  // Seed form state once the profile loads.
  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? '');
    setEmail(profile.email ?? '');
  }, [profile]);

  // Cleanup object URLs to avoid leaks.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const currentAvatar =
    previewUrl ?? (!removeAvatar ? profile?.avatar_url ?? null : null);

  const initial = (fullName || profile?.full_name || profile?.email || 'U')
    .charAt(0)
    .toUpperCase();

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so the same file can be re-picked
    if (!file) return;

    if (!ALLOWED_MIME.has(file.type)) {
      toast.error(t('unsupportedImage'), {
        description: t('unsupportedImageDesc'),
      });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(t('imageTooLarge'), {
        description: t('imageTooLargeDesc'),
      });
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingAvatar(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemoveAvatar(false);
  };

  const onRemoveAvatar = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingAvatar(null);
    setPreviewUrl(null);
    setRemoveAvatar(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      toast.error(t('nameRequired'));
      return;
    }
    const trimmedEmail = email.trim();
    if (!EMAIL_RE.test(trimmedEmail)) {
      toast.error(t('invalidEmail'));
      return;
    }

    setSaving(true);
    try {
      let nextAvatarUrl: string | null = profile.avatar_url ?? null;

      // Upload a newly-staged image, if any.
      if (pendingAvatar) {
        try {
          const { publicUrl } = await uploadAccountMedia(
            'avatars',
            pendingAvatar,
          );
          nextAvatarUrl = publicUrl;
        } catch (uploadErr) {
          throw new Error(
            t('uploadFailed', {
              message:
                uploadErr instanceof Error
                  ? uploadErr.message
                  : String(uploadErr),
            }),
          );
        }
      } else if (removeAvatar) {
        nextAvatarUrl = null;
      }

      // Persist name + avatar to profiles.
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: trimmedName,
          avatar_url: nextAvatarUrl,
        })
        .eq('user_id', user.id);
      if (updateError) {
        throw new Error(t('saveFailed', { message: updateError.message }));
      }

      // Email change goes through Supabase Auth, which emails a
      // confirmation to both the old and new addresses. We don't
      // touch profiles.email — Supabase will push the change there
      // after the user clicks the link (handled by the handle_new_user
      // trigger pattern in production deployments).
      let emailSent = false;
      if (trimmedEmail.toLowerCase() !== profile.email.toLowerCase()) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: trimmedEmail,
        });
        if (emailError) {
          // Partial success: name/avatar saved but email didn't.
          toast.success(t('profileSaved'));
          toast.error(t('emailChangeFailed', { message: emailError.message }));
          setSaving(false);
          await refreshProfile();
          return;
        }
        emailSent = true;
      }

      setEmailChangePending(emailSent);
      setPendingAvatar(null);
      setPreviewUrl(null);
      setRemoveAvatar(false);
      await refreshProfile();

      toast.success(
        emailSent
          ? t('profileSavedEmailCheck')
          : t('profileSaved'),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (!profile) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFullName(profile.full_name ?? '');
    setEmail(profile.email ?? '');
    setPendingAvatar(null);
    setPreviewUrl(null);
    setRemoveAvatar(false);
    setEmailChangePending(false);
  };

  const dirty =
    !!profile &&
    (fullName.trim() !== (profile.full_name ?? '') ||
      email.trim().toLowerCase() !== (profile.email ?? '').toLowerCase() ||
      pendingAvatar !== null ||
      removeAvatar);

  const joined = user?.created_at
    ? formatDate(user.created_at, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—';

  return (
    <section className="max-w-2xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title={t('title')}
        description={t('description')}
      />

      <div className="space-y-8">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <CardTitle className={settingsType.sectionTitle}>
                {t('title')}
              </CardTitle>
              <SettingsScopeChip scope="personal" />
            </div>
            <CardDescription className={settingsType.body}>
              {t('description')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form id="profile-form" onSubmit={onSubmit} className="space-y-6">
              <div className="flex flex-wrap items-center gap-5">
                <Avatar size="lg" className="size-16">
                  {currentAvatar ? (
                    <AvatarImage src={currentAvatar} alt={fullName || 'Avatar'} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-base text-primary">
                    {initial}
                  </AvatarFallback>
                </Avatar>

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
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                    className="min-h-11 sm:min-h-8"
                  >
                    <Upload className="size-4" />
                    {currentAvatar ? t('changePhoto') : t('uploadPhoto')}
                  </Button>
                  {currentAvatar && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={onRemoveAvatar}
                      disabled={saving}
                      className="min-h-11 text-muted-foreground hover:text-foreground sm:min-h-8"
                    >
                      <Trash2 className="size-4" />
                      {t('remove')}
                    </Button>
                  )}
                  <p className={cn('w-full', settingsType.meta)}>{t('photoHint')}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-full-name">{t('displayName')}</Label>
                <Input
                  id="profile-full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ada Lovelace"
                  maxLength={120}
                  disabled={saving}
                  required
                  className="h-11 text-base md:h-9 md:text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email">{t('email')}</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={saving}
                  required
                  className="h-11 text-base md:h-9 md:text-sm"
                />
                {emailChangePending && (
                  <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                    <Mail className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      {t.rich('emailChangeHint', {
                        oldEmail: profile?.email || '',
                        newEmail: email,
                        bold: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                      })}
                    </span>
                  </p>
                )}
              </div>

              {!profile && (
                <p className={cn('flex items-center gap-2', settingsType.body)}>
                  <CircleAlert className="size-4" />
                  {t('loading')}
                </p>
              )}
            </form>
          </CardContent>

          <SettingsFormFooter
            formId="profile-form"
            dirty={dirty}
            saving={saving}
            onDiscard={discard}
            saveLabel={t('saveChanges')}
            savingLabel={t('saving')}
          />
        </Card>

        <section className="space-y-3 border-t border-border pt-8">
          <h3 className={settingsType.sectionTitle}>{t('accountDetails')}</h3>
          <div className="rounded-xl bg-muted/30 p-4 ring-1 ring-foreground/10">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className={settingsType.meta}>{t('role')}</dt>
                <dd className="mt-0.5 font-mono text-foreground">
                  {profile?.role ?? 'user'}
                </dd>
              </div>
              <div>
                <dt className={settingsType.meta}>{t('joined')}</dt>
                <dd className="mt-0.5 text-foreground">{joined}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className={settingsType.meta}>{t('userId')}</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
                  {user?.id ?? '—'}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </section>
  );
}
