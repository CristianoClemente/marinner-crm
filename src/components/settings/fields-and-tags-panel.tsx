'use client';

import { useTranslations } from 'next-intl';

import { SettingsPanelHead } from './settings-panel-head';
import { TagManager } from './tag-manager';

/**
 * Seção de etiquetas do workspace.
 * (Campos personalizados foram removidos — dados de contato passam
 * pelas colunas fixas de `contacts`.)
 */
export function FieldsAndTagsPanel() {
  const t = useTranslations('Settings.tagsAndFields');

  return (
    <section className="max-w-3xl animate-in fade-in-50 space-y-4 duration-200">
      <SettingsPanelHead
        title={t('title')}
        description={t('descriptionTagsOnly')}
      />
      <TagManager />
    </section>
  );
}
