'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Copy,
  Loader2,
  QrCode,
  Unplug,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const MASKED = '••••••••••••••••';

type Props = {
  hasConfig: boolean
  instanceIdInitial: string
  connected: boolean
  webhookUrl: string
  onSaved: () => Promise<void>
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

  useEffect(() => {
    setInstanceId(instanceIdInitial);
    setLiveConnected(connected);
  }, [instanceIdInitial, connected]);

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/whatsapp/zapi/status');
      const data = await res.json();
      setLiveConnected(Boolean(data.connected));
      return Boolean(data.connected);
    } catch {
      return false;
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadQr = useCallback(async () => {
    setQrLoading(true);
    try {
      const res = await fetch('/api/whatsapp/zapi/qr');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('zapiQrFailed'));
        setQrValue(null);
        return;
      }
      if (data.challenge) {
        toast.error(t('zapiChallengeRequired'));
        setQrValue(null);
        return;
      }
      let value = data.value as string;
      if (value && !value.startsWith('data:')) {
        value = `data:image/png;base64,${value}`;
      }
      setQrValue(value || null);
    } catch {
      toast.error(t('zapiQrFailed'));
    } finally {
      setQrLoading(false);
    }
  }, [t]);

  // Poll status + refresh QR while disconnected after save
  useEffect(() => {
    if (!hasConfig || liveConnected) return;
    void loadQr();
    const id = window.setInterval(async () => {
      const ok = await refreshStatus();
      if (ok) {
        setQrValue(null);
        toast.success(t('zapiConnected'));
        await onSaved();
      } else {
        void loadQr();
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [hasConfig, liveConnected, loadQr, refreshStatus, onSaved, t]);

  async function handleSave() {
    if (!instanceId.trim()) {
      toast.error(t('zapiInstanceIdRequired'));
      return;
    }
    if (!hasConfig && (!instanceTokenEdited || !clientTokenEdited)) {
      toast.error(t('zapiTokensRequired'));
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

      if (data.connected) {
        toast.success(t('zapiConnected'));
        setLiveConnected(true);
      } else {
        toast.success(t('zapiSavedScanQr'));
        setLiveConnected(false);
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
      await onSaved();
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

  return (
    <div className="space-y-6">
      <Alert
        variant={liveConnected ? 'default' : 'destructive'}
        className={
          liveConnected
            ? 'border-emerald-500/30 bg-emerald-500/10'
            : undefined
        }
      >
        {liveConnected ? (
          <CheckCircle2 className="size-4 text-emerald-500" />
        ) : (
          <XCircle className="size-4" />
        )}
        <AlertTitle>
          {liveConnected ? t('zapiStatusConnected') : t('zapiStatusDisconnected')}
        </AlertTitle>
        <AlertDescription>
          {liveConnected ? t('zapiStatusConnectedDesc') : t('zapiStatusDisconnectedDesc')}
        </AlertDescription>
      </Alert>

      <Alert>
        <AlertTitle>{t('zapiMetaOnlyTitle')}</AlertTitle>
        <AlertDescription>{t('zapiMetaOnlyDesc')}</AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">{t('zapiCredentialsTitle')}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('zapiCredentialsDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">{t('zapiInstanceId')}</Label>
            <Input
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              placeholder="A20DA9C0..."
              className="bg-muted border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">{t('zapiInstanceToken')}</Label>
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
              className="bg-muted border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">{t('zapiClientToken')}</Label>
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
              className="bg-muted border-border"
            />
            <p className="text-xs text-muted-foreground">{t('zapiClientTokenHint')}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                t('saveConfig')
              )}
            </Button>
            {hasConfig && (
              <>
                <Button
                  variant="outline"
                  onClick={() => void refreshStatus()}
                  disabled={statusLoading}
                >
                  {statusLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  {t('testConnection')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleDisconnect()}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Unplug className="size-4" />
                  )}
                  {t('zapiDisconnect')}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {hasConfig && !liveConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <QrCode className="size-4 text-primary" />
              {t('zapiQrTitle')}
            </CardTitle>
            <CardDescription>{t('zapiQrDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {qrLoading && !qrValue ? (
              <Loader2 className="size-8 animate-spin text-primary" />
            ) : qrValue ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrValue}
                alt="QR Code Z-API"
                className="size-56 rounded-lg border border-border bg-white p-2"
              />
            ) : (
              <p className="text-sm text-muted-foreground">{t('zapiQrEmpty')}</p>
            )}
            <Button variant="outline" size="sm" onClick={() => void loadQr()}>
              <RefreshCw className="size-4" />
              {t('zapiQrRefresh')}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">{t('webhookTitle')}</CardTitle>
          <CardDescription>{t('zapiWebhookDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label className="text-muted-foreground">{t('webhookUrl')}</Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={webhookUrl}
              className="bg-muted border-border font-mono text-sm"
            />
            <Button type="button" variant="outline" size="icon" onClick={copyWebhook}>
              <Copy className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('zapiWebhookAuto')}</p>
        </CardContent>
      </Card>
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
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('meta')}
        className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          value === 'meta'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {t('providerMeta')}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('zapi')}
        className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          value === 'zapi'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {t('providerZapi')}
      </button>
    </div>
  );
}
