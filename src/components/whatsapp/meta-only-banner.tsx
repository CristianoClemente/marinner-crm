'use client'

import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type MetaOnlyFeature = 'templates' | 'broadcast' | 'interactive' | 'reactions'

export function MetaOnlyBanner({ feature }: { feature: MetaOnlyFeature }) {
  const t = useTranslations('WhatsApp.metaOnly')

  return (
    <Alert className="border-amber-600/40 bg-amber-950/30">
      <AlertTriangle className="size-4 text-amber-400" />
      <AlertTitle className="text-amber-200">{t('title')}</AlertTitle>
      <AlertDescription className="text-amber-100/80">
        {t(feature)}
      </AlertDescription>
    </Alert>
  )
}
