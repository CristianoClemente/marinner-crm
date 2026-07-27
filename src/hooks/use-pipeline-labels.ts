'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  localizePipelineName,
  localizeStageName,
  type DefaultStageKey,
} from '@/lib/pipelines/default-stages';

/** Rótulos localizados para funil/etapas padrão sem alterar o contrato do banco. */
export function usePipelineLabels() {
  const tStages = useTranslations('Pipelines.defaultStages');
  const tPipeline = useTranslations('Pipelines');

  const stageLabel = useCallback(
    (storedName: string) =>
      localizeStageName(storedName, (key: DefaultStageKey) => tStages(key)),
    [tStages],
  );

  const pipelineLabel = useCallback(
    (storedName: string) =>
      localizePipelineName(storedName, (key) => tPipeline(key)),
    [tPipeline],
  );

  return { stageLabel, pipelineLabel };
}
