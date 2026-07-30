'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { toIntegerText } from '@/lib/catalog/stock';
import type { CatalogItem, CatalogItemKind } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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

interface CatalogItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CatalogItem | null;
  onSaved: () => void;
}

export function CatalogItemForm({
  open,
  onOpenChange,
  item,
  onSaved,
}: CatalogItemFormProps) {
  const t = useTranslations('Catalog.form');
  const isEdit = !!item;

  const [kind, setKind] = useState<CatalogItemKind>('service');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [unitPrice, setUnitPrice] = useState('0');
  const [initialStock, setInitialStock] = useState('0');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setKind(item.kind);
      setName(item.name);
      setSku(item.sku ?? '');
      setUnitPrice(String(item.unit_price));
      setDescription(item.description ?? '');
      setActive(item.active);
      setInitialStock('0');
    } else {
      setKind('service');
      setName('');
      setSku('');
      setUnitPrice('0');
      setInitialStock('0');
      setDescription('');
      setActive(true);
    }
  }, [open, item]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit && item) {
        const res = await fetch(`/api/catalog/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            sku: sku || null,
            unit_price: Number(unitPrice),
            description: description || null,
            active,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('saveError'));
        toast.success(t('saved'));
      } else {
        const res = await fetch('/api/catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind,
            name,
            sku: sku || null,
            unit_price: Number(unitPrice),
            description: description || null,
            initial_stock: kind === 'product' ? Number(initialStock) : 0,
            active,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('saveError'));
        toast.success(t('created'));
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('editTitle') : t('createTitle')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="max-h-[60dvh] space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain">
            {!isEdit && (
              <div className="space-y-1.5">
                <Label>{t('kind')}</Label>
                <Select
                  value={kind}
                  onValueChange={(v) =>
                    setKind((v as CatalogItemKind) || 'service')
                  }
                >
                  <SelectTrigger className="w-full">
                    {/* Sem children o primitivo mostra o valor cru do enum
                        ("service"); o rótulo traduzido vem daqui. */}
                    <SelectValue>
                      {kind === 'product' ? t('kindProduct') : t('kindService')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">{t('kindService')}</SelectItem>
                    <SelectItem value="product">{t('kindProduct')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cat-name">{t('name')}</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                required
                className="text-base md:text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="cat-price">{t('price')}</Label>
                <Input
                  id="cat-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  required
                  className="text-base tabular-nums md:text-sm"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="cat-sku">{t('sku')}</Label>
                <Input
                  id="cat-sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder={t('skuPlaceholder')}
                  className="text-base md:text-sm"
                />
              </div>
            </div>

            {!isEdit && kind === 'product' && (
              <div className="space-y-1.5">
                <Label htmlFor="cat-stock">{t('initialStock')}</Label>
                {/* `type="text"` de propósito: com `type="number"` o navegador
                    devolve string vazia em estados intermediários como "2." e o
                    dígito já digitado desaparecia do campo. */}
                <Input
                  id="cat-stock"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={initialStock}
                  onChange={(e) =>
                    setInitialStock(toIntegerText(e.target.value))
                  }
                  className="text-base tabular-nums md:text-sm"
                />
                <p className="text-muted-foreground text-sm">
                  {t('initialStockHint')}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">{t('description')}</Label>
              <Textarea
                id="cat-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {isEdit && (
              <div className="bg-muted/40 flex items-start justify-between gap-3 rounded-lg px-3 py-2.5">
                <div className="min-w-0">
                  <p id="cat-active-label" className="text-sm font-medium">
                    {t('active')}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {t('activeHint')}
                  </p>
                </div>
                <Switch
                  checked={active}
                  onCheckedChange={(v) => setActive(!!v)}
                  aria-labelledby="cat-active-label"
                  className="mt-0.5 shrink-0"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
