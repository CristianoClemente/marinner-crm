'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { formatDateTime, formatNumber } from '@/lib/format';
import { toIntegerText } from '@/lib/catalog/stock';
import type { CatalogItem, StockMovement, StockMovementReason } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface CatalogStockPanelProps {
  item: CatalogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

type AdjustReason = 'adjustment_in' | 'adjustment_out' | 'correction';

/** Liga o botão do rodapé ao formulário de ajuste via atributo `form`. */
const FORM_ID = 'catalog-stock-adjust';

export function CatalogStockPanel({
  item,
  open,
  onOpenChange,
  onChanged,
}: CatalogStockPanelProps) {
  const t = useTranslations('Catalog.stockPanel');
  const [movements, setMovements] = useState<StockMovement[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  // Saldo local: depois de um ajuste a prop `item` ainda traz o valor antigo,
  // e mostrar saldo desatualizado no painel de estoque é pior que não mostrar.
  const [balance, setBalance] = useState(0);
  const [reason, setReason] = useState<AdjustReason>('adjustment_in');
  const [qty, setQty] = useState('1');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const itemId = item?.id;

  const loadHistory = useCallback(async () => {
    if (!itemId) return;
    setMovements(null);
    try {
      const res = await fetch(`/api/catalog/${itemId}/stock`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('historyError'));
      setMovements(data.movements ?? []);
      setHistoryError(null);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : t('historyError'));
    }
  }, [itemId, t]);

  useEffect(() => {
    if (!open || !item) return;
    setBalance(Number(item.stock_qty));
    setReason('adjustment_in');
    setQty('1');
    setNote('');
    void loadHistory();
  }, [open, item, loadHistory]);

  const qtyNum = Number(qty);
  const qtyValid =
    Number.isInteger(qtyNum) &&
    qtyNum !== 0 &&
    (reason === 'correction' || qtyNum > 0);

  function reasonLabel(value: StockMovementReason) {
    switch (value) {
      case 'sale':
        return t('reasonSale');
      case 'initial':
        return t('reasonInitial');
      case 'adjustment_in':
        return t('reasonIn');
      case 'adjustment_out':
        return t('reasonOut');
      case 'correction':
        return t('reasonCorrection');
      case 'sale_refund':
        return t('reasonSaleRefund');
    }
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!item || !qtyValid) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/catalog/${item.id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, qty: qtyNum, note: note || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      toast.success(t('adjusted'));
      if (data.item) setBalance(Number(data.item.stock_qty));
      setQty('1');
      setNote('');
      onChanged();
      await loadHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title', { name: item?.name ?? '' })}</DialogTitle>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                'text-lg font-semibold tabular-nums',
                balance <= 0 ? 'text-destructive' : 'text-foreground'
              )}
            >
              {formatNumber(balance)}
            </span>
            <span className="text-muted-foreground text-sm">
              {t('currentLabel')}
            </span>
          </div>
        </DialogHeader>

        <div className="max-h-[60dvh] space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain">
          <form id={FORM_ID} onSubmit={handleAdjust} className="space-y-3">
            <p className="text-foreground text-sm font-medium">{t('adjust')}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label>{t('reason')}</Label>
                <Select
                  value={reason}
                  onValueChange={(v) => {
                    if (!v) return;
                    const next = v as AdjustReason;
                    setReason(next);
                    // Só correção aceita sinal; senão o campo ficaria inválido
                    // sem o operador entender por quê.
                    if (next !== 'correction') {
                      setQty((q) => q.replace('-', ''));
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    {/* Sem children o primitivo mostraria o enum cru
                        ("adjustment_in"). */}
                    <SelectValue>{reasonLabel(reason)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adjustment_in">{t('in')}</SelectItem>
                    <SelectItem value="adjustment_out">{t('out')}</SelectItem>
                    <SelectItem value="correction">
                      {t('correction')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="stock-qty">{t('qty')}</Label>
                {/* `type="text"` de propósito: com `type="number"` o navegador
                    devolve string vazia em estados intermediários como "2." e o
                    dígito já digitado desaparecia do campo. */}
                <Input
                  id="stock-qty"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={qty}
                  onChange={(e) =>
                    setQty(
                      toIntegerText(e.target.value, {
                        allowNegative: reason === 'correction',
                      })
                    )
                  }
                  required
                  className="text-base tabular-nums md:text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock-note">{t('note')}</Label>
              <Input
                id="stock-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('notePlaceholder')}
                className="text-base md:text-sm"
              />
            </div>
          </form>

          <div>
            <p className="text-foreground text-sm font-medium">
              {t('history')}
            </p>

            {historyError ? (
              <div className="bg-destructive/10 mt-3 flex flex-col items-start gap-2 rounded-lg px-3 py-2.5">
                <p className="text-destructive flex items-center gap-2 text-sm">
                  <AlertCircle className="size-4 shrink-0" />
                  {historyError}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void loadHistory()}
                >
                  <RotateCcw className="size-3.5" />
                  {t('retry')}
                </Button>
              </div>
            ) : movements === null ? (
              <ul aria-busy className="divide-border mt-2 divide-y">
                {[0, 1, 2].map((i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="bg-muted h-3 w-32 animate-pulse rounded" />
                    <span className="bg-muted h-3 w-10 animate-pulse rounded" />
                  </li>
                ))}
              </ul>
            ) : movements.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-sm">
                {t('historyEmpty')}
              </p>
            ) : (
              <ul className="divide-border mt-1 divide-y">
                {movements.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-foreground text-sm">
                        {reasonLabel(m.reason)}
                      </p>
                      {m.note && (
                        <p className="text-muted-foreground truncate text-xs">
                          {m.note}
                        </p>
                      )}
                      <time className="text-muted-foreground text-xs">
                        {formatDateTime(m.created_at)}
                      </time>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-sm font-semibold tabular-nums',
                        m.qty < 0 ? 'text-muted-foreground' : 'text-foreground'
                      )}
                    >
                      {m.qty < 0 ? '−' : '+'}
                      {formatNumber(Math.abs(m.qty))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t('close')}
          </Button>
          {/* Fora do <form> pelo atributo `form`: o rodapé é o lugar da ação
              principal, mas o submit continua sendo do formulário de ajuste. */}
          <Button type="submit" form={FORM_ID} disabled={saving || !qtyValid}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? t('saving') : t('apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
