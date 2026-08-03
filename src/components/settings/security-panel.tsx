'use client';

import { PasswordForm } from './password-form';
import { SessionsCard } from './sessions-card';
import { SettingsPanelHead } from './settings-panel-head';
import { useTranslations } from 'next-intl';

/**
 * Login e segurança — senha (persistida) e sessões (ação destrutiva),
 * em zonas separadas como em Aparência.
 */
export function SecurityPanel() {
  const t = useTranslations('Settings.security');
  return (
    <section className="max-w-2xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title={t('title')}
        description={t('description')}
      />
      <div className="space-y-10">
        <PasswordForm />
        <div className="border-t border-border pt-8">
          <SessionsCard />
        </div>
      </div>
    </section>
  );
}
