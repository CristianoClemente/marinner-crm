'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { SettingsScopeChip } from './settings-scope-chip';
import { settingsType } from './settings-type';

const MIN_PASSWORD = 8;

export function PasswordForm() {
  const t = useTranslations('Settings.profile');
  const { profile } = useAuth();
  const supabase = createClient();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const dirty = Boolean(current || next || confirm);

  const discard = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setConfirmError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.email) {
      toast.error(t('cannotChangeNoEmail'));
      return;
    }
    if (next.length < MIN_PASSWORD) {
      setConfirmError(t('passwordTooShort', { min: MIN_PASSWORD }));
      return;
    }
    if (next !== confirm) {
      setConfirmError(t('passwordMismatch'));
      return;
    }
    setConfirmError(null);
    setSaving(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: current,
      });
      if (signInError) {
        toast.error(t('currentPasswordIncorrect'));
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: next,
      });
      if (updateError) {
        toast.error(t('passwordUpdateFailed', { message: updateError.message }));
        return;
      }

      discard();
      toast.success(t('passwordUpdated'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className={cn('flex items-center gap-2', settingsType.sectionTitle)}>
            <KeyRound className="size-4 text-primary" aria-hidden />
            {t('passwordTitle')}
          </CardTitle>
          <SettingsScopeChip scope="personal" />
        </div>
        <CardDescription className={settingsType.body}>
          {t('passwordDesc', { min: MIN_PASSWORD })}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form id="password-form" onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">{t('currentPassword')}</Label>
            <PasswordInput
              id="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              disabled={saving}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('newPassword')}</Label>
              <PasswordInput
                id="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                minLength={MIN_PASSWORD}
                disabled={saving}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t('confirmPassword')}</Label>
              <PasswordInput
                id="confirm-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={MIN_PASSWORD}
                disabled={saving}
                required
              />
            </div>
          </div>

          {confirmError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {confirmError}
            </p>
          )}
        </form>
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/20">
        <Button
          type="button"
          variant="ghost"
          disabled={!dirty || saving}
          className="min-h-11 sm:min-h-8"
          onClick={discard}
        >
          {t('cancel')}
        </Button>
        <Button
          type="submit"
          form="password-form"
          disabled={saving || !current || !next || !confirm}
          className="min-h-11 sm:min-h-8"
        >
          {saving ? t('updating') : t('updatePassword')}
        </Button>
      </CardFooter>
    </Card>
  );
}
