'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Copy,
  Loader2,
  QrCode,
  Unplug,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  SettingsChip,
  StatusDot,
} from '@/components/settings/settings-chip';

const MASKED = '••••••••••••••••';

type Props = {
  hasConfig: boolean;
  instanceIdInitial: string;
  connected: boolean;
  webhookUrl: string;
  onSaved: () => Promise<void>;
};

export function WhatsAppZapiPanel({
  hasConfig,
  instanceIdInitial,
  connected,
  webhookUrl,
  onSaved,
}: Props) {
  const t = useTranslations('Settings.whatsapp');
  const [instanceId, setInstanceId] = useState(instanceIdInitial);
  const [instanceToken, setInstanceToken] = useState(hasConfig ? MASKED : '');
  const [clientToken, setClientToken] = useState(hasConfig ? MASKED : '');
  const [instanceTokenEdited, setInstanceTokenEdited] = useState(false);
  const [clientTokenEdited, setClientTokenEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [liveConnected, setLiveConnected] = useState(connected);
  const [tokensBroken, setTokensBroken] = useState(false);
  const qrErrorToastedRef = useRef(false);

  useEffect(() => {
    setInstanceId(instanceIdInitial);
  }, [instanceIdInitial]);

  useEffect(() => {
    if (saving) return;
    setLiveConnected(connected);
    if (connected) setQrValue(null);
  }, [connected, saving]);

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/whatsapp/zapi/status');
      const data = await res.json();
      if (data.needs_reset || data.reason === 'token_corrupted') {
        setTokensBroken(true);
        setLiveConnected(false);
        return false;
      }
      setTokensBroken(false);
      setLiveConnected(Boolean(data.connected));
      return Boolean(data.connected);
    } catch {
      return false;
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadQr = useCallback(async (): Promise<boolean> => {
    setQrLoading(true);
    try {
      const res = await fetch('/api/whatsapp/zapi/qr');
      const data = await res.json();
      if (!res.ok) {
        if (data.needs_reset || data.reason === 'token_corrupted') {
          setTokensBroken(true);
        }
        if (!qrErrorToastedRef.current) {
          qrErrorToastedRef.current = true;
          toast.error(data.error || t('zapiQrFailed'));
        }
        setQrValue(null);
        return false;
      }
      qrErrorToastedRef.current = false;
      if (data.challenge) {
        toast.error(t('zapiChallengeRequired'));
        setQrValue(null);
        return false;
      }
      let value = data.value as string;
      if (value && !value.startsWith('data:')) {
        value = `data:image/png;base64,${value}`;
      }
      setQrValue(value || null);
      return Boolean(value);
    } catch {
      if (!qrErrorToastedRef.current) {
        qrErrorToastedRef.current = true;
        toast.error(t('zapiQrFailed'));
      }
      return false;
    } finally {
      setQrLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!hasConfig || liveConnected || tokensBroken) return;

    let cancelled = false;
    void (async () => {
      const ok = await refreshStatus();
      if (cancelled || ok) return;
      await loadQr();
    })();

    const id = window.setInterval(async () => {
      const ok = await refreshStatus();
      if (ok) {
        setQrValue(null);
        toast.success(t('zapiConnected'));
        await onSaved();
      } else if (!cancelled) {
        await loadQr();
      }
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    hasConfig,
    liveConnected,
    tokensBroken,
    loadQr,
    refreshStatus,
    onSaved,
    t,
  ]);

  async function handleSave() {
    if (!instanceId.trim()) {
      toast.error(t('zapiInstanceIdRequired'));
      return;
    }
    if (!hasConfig && (!instanceTokenEdited || !clientTokenEdited)) {
      toast.error(t('zapiTokensRequired'));
      return;
    }
    if (
      tokensBroken &&
      (!instanceTokenEdited ||
        !clientTokenEdited ||
        !instanceToken.trim() ||
        !clientToken.trim() ||
        instanceToken.includes('•') ||
        clientToken.includes('•'))
    ) {
      toast.error(t('zapiTokensReenterRequired'));
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        provider: 'zapi',
        zapi_instance_id: instanceId.trim(),
      };
      if (instanceTokenEdited && instanceToken && !instanceToken.includes('•')) {
        payload.zapi_instance_token = instanceToken.trim();
      }
      if (clientTokenEdited && clientToken && !clientToken.includes('•')) {
        payload.zapi_client_token = clientToken.trim();
      }

      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('saveFailed'));
        return;
      }

      if (data.webhook_error) {
        toast.error(`${t('zapiWebhookWarn')}: ${data.webhook_error}`, {
          duration: 10000,
        });
      }

      setTokensBroken(false);
      qrErrorToastedRef.current = false;

      if (data.connected) {
        toast.success(t('zapiConnected'));
        setLiveConnected(true);
        setQrValue(null);
      } else {
        toast.success(t('zapiSavedScanQr'));
        setLiveConnected(false);
        await loadQr();
      }

      setInstanceToken(MASKED);
      setClientToken(MASKED);
      setInstanceTokenEdited(false);
      setClientTokenEdited(false);
      await onSaved();
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm(t('zapiDisconnectConfirm'))) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/whatsapp/zapi/disconnect', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('zapiDisconnectFailed'));
        return;
      }
      toast.success(t('zapiDisconnected'));
      setLiveConnected(false);
      setTokensBroken(false);
      qrErrorToastedRef.current = false;
      await onSaved();
      await loadQr();
    } catch {
      toast.error(t('zapiDisconnectFailed'));
    } finally {
      setDisconnecting(false);
    }
  }

  function copyWebhook() {
    void navigator.clipboard.writeText(webhookUrl);
    toast.success(t('webhookCopied'));
  }

  const statusVariant = tokensBroken
    ? 'warn'
    : liveConnected
      ? 'ok'
      : 'muted';
  const statusLabel = tokensBroken
    ? t('zapiTokensBrokenTitle')
    : liveConnected
      ? t('zapiStatusConnected')
      : t('zapiStatusDisconnected');
  const statusHint = tokensBroken
    ? t('zapiTokensBrokenDesc')
    : liveConnected
      ? t('zapiStatusConnectedDesc')
      : t('zapiStatusDisconnectedDesc');

  const showQr = hasConfig && !liveConnected && !tokensBroken;

  return (
    <div className="space-y-6">
      {/* Status — uma faixa, não três Alerts */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <SettingsChip variant={statusVariant}>
                <StatusDot tone={liveConnected && !tokensBroken ? 'ok' : 'muted'} />
                {statusLabel}
              </SettingsChip>
            </div>
            <p className="max-w-[52ch] text-sm text-muted-foreground">
              {statusHint}
            </p>
            {liveConnected && !tokensBroken ? (
              <p className="text-xs text-muted-foreground">
                {t('zapiNeedNewQrHint')}
              </p>
            ) : null}
          </div>
          {hasConfig ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refreshStatus()}
                disabled={statusLoading || tokensBroken}
              >
                {statusLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {t('testConnection')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleDisconnect()}
                disabled={disconnecting || tokensBroken}
              >
                {disconnecting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Unplug className="size-4" />
                )}
                {t('zapiDisconnect')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Credenciais + QR (QR é a ação principal quando desconectado) */}
      <div
        className={cn(
          'grid gap-4',
          showQr ? 'lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start' : '',
        )}
      >
        <div className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div>
            <h3 className="text-base font-medium text-foreground">
              {t('zapiCredentialsTitle')}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {tokensBroken
                ? t('zapiTokensReenterRequired')
                : t('zapiCredentialsDesc')}
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t('zapiInstanceId')}</Label>
              <Input
                value={instanceId}
                onChange={(e) => setInstanceId(e.target.value)}
                placeholder="A20DA9C0..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('zapiInstanceToken')}</Label>
              <PasswordInput
                value={instanceToken}
                onChange={(e) => {
                  setInstanceToken(e.target.value);
                  setInstanceTokenEdited(true);
                }}
                onFocus={() => {
                  if (!instanceTokenEdited && instanceToken === MASKED) {
                    setInstanceToken('');
                    setInstanceTokenEdited(true);
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('zapiClientToken')}</Label>
              <PasswordInput
                value={clientToken}
                onChange={(e) => {
                  setClientToken(e.target.value);
                  setClientTokenEdited(true);
                }}
                onFocus={() => {
                  if (!clientTokenEdited && clientToken === MASKED) {
                    setClientToken('');
                    setClientTokenEdited(true);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                {t('zapiClientTokenHint')}
              </p>
            </div>
          </div>

          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('saveConfig')}
          </Button>
        </div>

        {showQr ? (
          <aside className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:sticky lg:top-4">
            <div className="mb-3 flex items-center gap-2">
              <QrCode className="size-4 text-primary" />
              <h3 className="text-sm font-medium text-foreground">
                {t('zapiQrTitle')}
              </h3>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">{t('zapiQrDesc')}</p>

            <div className="flex flex-col items-center gap-3">
              {qrLoading && !qrValue ? (
                <div className="flex size-52 items-center justify-center rounded-lg bg-muted/50">
                  <Loader2 className="size-7 animate-spin text-muted-foreground" />
                </div>
              ) : qrValue ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrValue}
                  alt=""
                  className="size-52 rounded-lg bg-white p-2 ring-1 ring-foreground/10"
                />
              ) : (
                <div className="flex size-52 flex-col items-center justify-center gap-2 rounded-lg bg-muted/40 px-4 text-center">
                  <AlertTriangle className="size-5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{t('zapiQrEmpty')}</p>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => void loadQr()}
                disabled={qrLoading}
              >
                {qrLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {t('zapiQrRefresh')}
              </Button>
            </div>
          </aside>
        ) : null}
      </div>

      {/* Webhook — disclosure, não card competindo */}
      <details className="group rounded-xl bg-card ring-1 ring-foreground/10 open:pb-4">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            {t('webhookTitle')}
            <span className="text-xs font-normal text-muted-foreground group-open:hidden">
              {t('zapiWebhookSummary')}
            </span>
          </span>
        </summary>
        <div className="space-y-2 border-t border-border px-4 pt-3">
          <p className="text-xs text-muted-foreground">{t('zapiWebhookDesc')}</p>
          <Label className="text-xs text-muted-foreground">{t('webhookUrl')}</Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={webhookUrl}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copyWebhook}
              aria-label={t('copyWebhook')}
              className="size-9 shrink-0"
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('zapiWebhookAuto')}</p>
        </div>
      </details>
    </div>
  );
}

export function ProviderToggle({
  value,
  onChange,
  disabled,
}: {
  value: 'meta' | 'zapi';
  onChange: (v: 'meta' | 'zapi') => void;
  disabled?: boolean;
}): ReactNode {
  const t = useTranslations('Settings.whatsapp');
  return (
    <div
      role="tablist"
      aria-label={t('providerToggleAria')}
      className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1 ring-1 ring-foreground/10"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'meta'}
        disabled={disabled}
        onClick={() => onChange('meta')}
        className={cn(
          'min-h-10 rounded-md px-2 py-2 text-sm leading-tight font-medium transition-colors sm:min-h-0 sm:px-3',
          value === 'meta'
            ? 'bg-background text-foreground shadow-sm ring-1 ring-foreground/10'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {t('providerMeta')}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'zapi'}
        disabled={disabled}
        onClick={() => onChange('zapi')}
        className={cn(
          'min-h-10 rounded-md px-2 py-2 text-sm leading-tight font-medium transition-colors sm:min-h-0 sm:px-3',
          value === 'zapi'
            ? 'bg-background text-foreground shadow-sm ring-1 ring-foreground/10'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {t('providerZapi')}
      </button>
    </div>
  );
}
