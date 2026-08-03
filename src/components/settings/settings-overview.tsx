'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { THEMES } from '@/lib/themes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { SECTION_META, type SettingsSection } from './settings-sections';
import { SettingsChip, StatusDot } from './settings-chip';
import { settingsType } from './settings-type';
import { ROLE_META } from './role-meta';

interface OverviewCounts {
  members: number | null;
  pendingInvites: number | null;
  templates: number | null;
  templatesPending: number | null;
  tags: number | null;
}

interface WhatsAppStatus {
  configured: boolean;
  connected: boolean;
  provider: 'meta' | 'zapi' | null;
}

export function SettingsOverview({
  onSelect,
}: {
  onSelect: (section: SettingsSection) => void;
}) {
  const { user, profile, accountId, accountRole, canManageMembers } =
    useAuth();
  const { mode, theme } = useTheme();
  const t = useTranslations('Settings.overview');
  // Roles vivem em Settings.roles (mesmo namespace de members-tab / invite-dialog).
  // useTranslations('roles') procura a chave na raiz e dispara MISSING_MESSAGE.
  const tRoles = useTranslations('Settings.roles');
  const tSections = useTranslations('Settings.sections');
  const tAppearance = useTranslations('Settings.appearance');

  const [counts, setCounts] = useState<OverviewCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);
  // WhatsApp status is tracked separately: its health check decrypts the
  // token and pings Meta, which is far slower than the cheap count
  // queries. Gating it independently keeps a slow/flaky Meta round-trip
  // from blanking the rest of the landing.
  const [whatsapp, setWhatsapp] = useState<WhatsAppStatus | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(true);

  useEffect(() => {
    if (!user || !accountId) return;
    let cancelled = false;
    const supabase = createClient();
    const userId = user.id;
    const acctId = accountId;

    // Cheap counts — resolve fast, render immediately.
    (async () => {
      setCountsLoading(true);
      const [membersRes, invitesRes, templatesTotal, templatesPending, tagsRes] =
        await Promise.allSettled([
          fetch('/api/account/members', { cache: 'no-store' }).then((r) => r.json()),
          canManageMembers
            ? fetch('/api/account/invitations', { cache: 'no-store' }).then((r) =>
                r.json(),
              )
            : Promise.resolve(null),
          supabase
            .from('message_templates')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          supabase
            .from('message_templates')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'PENDING'),
          supabase
            .from('tags')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
        ]);

      if (cancelled) return;

      const members =
        membersRes.status === 'fulfilled' && Array.isArray(membersRes.value?.members)
          ? membersRes.value.members.length
          : null;
      const pendingInvites =
        invitesRes.status === 'fulfilled' &&
        invitesRes.value &&
        Array.isArray(invitesRes.value.invitations)
          ? invitesRes.value.invitations.length
          : null;

      setCounts({
        members,
        pendingInvites,
        templates:
          templatesTotal.status === 'fulfilled'
            ? templatesTotal.value.count ?? null
            : null,
        templatesPending:
          templatesPending.status === 'fulfilled'
            ? templatesPending.value.count ?? null
            : null,
        tags: tagsRes.status === 'fulfilled' ? tagsRes.value.count ?? null : null,
      });
      setCountsLoading(false);
    })();

    // WhatsApp connection status — slower, independent.
    (async () => {
      setWhatsappLoading(true);
      const [row, health] = await Promise.allSettled([
        supabase
          .from('whatsapp_config')
          .select('provider, phone_number_id, zapi_instance_id, status')
          .eq('account_id', acctId)
          .maybeSingle(),
        fetch('/api/whatsapp/config', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (cancelled) return;
      const cfg = row.status === 'fulfilled' ? row.value.data : null;
      const provider =
        cfg?.provider === 'zapi' || cfg?.provider === 'meta'
          ? cfg.provider
          : cfg
            ? 'meta'
            : null;
      const configured =
        provider === 'zapi'
          ? Boolean(cfg?.zapi_instance_id)
          : Boolean(cfg?.phone_number_id);
      setWhatsapp({
        configured,
        connected: health.status === 'fulfilled' && !!health.value?.connected,
        provider,
      });
      setWhatsappLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, accountId, canManageMembers]);

  const displayName = profile?.full_name || profile?.email || t('yourAccount');
  const initial = (profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase();
  const roleMeta = accountRole ? ROLE_META[accountRole] : null;
  const RoleIcon = roleMeta?.icon;

  const themeName = THEMES.find((t) => t.id === theme)?.name ?? theme;
  const modeLabel =
    mode === 'light' ? tAppearance('modeLight') : tAppearance('modeDark');

  // Per-tile loading + subtitle. `null` counts render as a graceful
  // fallback so a single failed query never blanks a tile.
  const tiles: {
    section: SettingsSection;
    loading: boolean;
    subtitle: ReactNode;
  }[] = [
    {
      section: 'whatsapp',
      loading: whatsappLoading,
      subtitle: !whatsapp?.configured ? (
        t('notSetup')
      ) : whatsapp.connected ? (
        <>
          <StatusDot tone="ok" />{' '}
          {whatsapp.provider === 'zapi'
            ? t('connectedZapi')
            : t('connected')}
        </>
      ) : (
        <>
          <StatusDot tone="muted" />{' '}
          {whatsapp.provider === 'zapi'
            ? t('needsQrZapi')
            : t('needsReconnecting')}
        </>
      ),
    },
    {
      section: 'members',
      loading: countsLoading,
      subtitle:
        counts?.members == null
          ? t('viewTeamMembers')
          : `${t('membersCount', { count: counts.members })}${
              counts.pendingInvites
                ? ` · ${t('pendingInvites', { count: counts.pendingInvites })}`
                : ''
            }`,
    },
    {
      section: 'templates',
      loading: countsLoading,
      subtitle:
        whatsapp?.provider === 'zapi'
          ? t('templatesMetaOnly')
          : counts?.templates == null
            ? t('manageTemplates')
            : `${t('templatesCount', { count: counts.templates })}${
                counts.templatesPending
                  ? ` · ${t('pendingReview', { count: counts.templatesPending })}`
                  : ''
              }`,
    },
    {
      section: 'fields',
      loading: countsLoading,
      subtitle:
        counts?.tags == null
          ? t('tagsAndFields')
          : t('tagsCount', { count: counts.tags }),
    },
    {
      section: 'appearance',
      loading: false,
      subtitle: t('appearance', { mode: modeLabel, theme: themeName }),
    },
    {
      section: 'jurisdictions',
      loading: false,
      subtitle: t('jurisdictions'),
    },
  ];

  return (
    <section className="animate-in fade-in-50 duration-200">
      {/* Identity. No mobile o chip de papel vai para uma segunda linha:
          disputando a mesma linha com o avatar, sobravam ~75px para o
          nome e o e-mail, que truncavam quase por completo. */}
      <Card className="items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:py-5">
        <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:flex-1 sm:gap-4">
          <Avatar size="lg" className="size-12 sm:size-14">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={displayName} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-xl text-primary">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className={cn('truncate', settingsType.sectionTitle)}>
              {displayName}
            </div>
            {profile?.email ? (
              <div className={cn('truncate', settingsType.body)}>
                {profile.email}
              </div>
            ) : null}
          </div>
        </div>
        {roleMeta && RoleIcon ? (
          <SettingsChip variant={roleMeta.variant}>
            <RoleIcon />
            {tRoles(accountRole!)}
          </SettingsChip>
        ) : null}
      </Card>

      {/* Status tiles */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map(({ section, loading, subtitle }) => {
          const meta = SECTION_META[section];
          const Icon = meta.icon;
          return (
            <button
              key={section}
              type="button"
              onClick={() => onSelect(section)}
              className={cn(
                'group flex items-start gap-3.5 rounded-xl border border-border bg-card p-4 text-left transition-colors',
                'hover:border-primary-soft-2 hover:bg-card-2',
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block', settingsType.sectionTitle)}>
                  {tSections(section)}
                </span>
                <span className={cn('mt-0.5 flex items-center gap-1.5', settingsType.body)}>
                  {loading ? (
                    <>
                      <Loader2 className="size-3 animate-spin" /> {t('loading')}
                    </>
                  ) : (
                    subtitle
                  )}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
