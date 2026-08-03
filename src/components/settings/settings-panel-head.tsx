import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { settingsType } from './settings-type';

/**
 * L1 do módulo Configurações — título da aba + descrição (L3).
 * Ver `settings-type.ts` para a escala de 3 níveis.
 */
export function SettingsPanelHead({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className={settingsType.panelTitle}>{title}</h2>
        {description ? (
          <p className={settingsType.panelDescription}>{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
