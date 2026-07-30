'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  Eye,
  GraduationCap,
  Loader2,
  Minus,
  MoreVertical,
  Package,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  SearchX,
  ShoppingCart,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/currency';
import { formatDateTime, formatNumber } from '@/lib/format';
import { formatSaleCode } from '@/lib/sales/code';
import { computeDiscountAmount } from '@/lib/sales/confirm';
import { useCan } from '@/hooks/use-can';
import type { CatalogItem, DiscountType, PaymentMethod, Sale } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GatedButton } from '@/components/ui/gated-button';
import { StateCard } from '@/components/ui/state-card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SaleRefundDialog } from '@/components/catalog/sale-refund-dialog';
import { SaleDetailDialog } from '@/components/catalog/sale-detail-dialog';
import { cn } from '@/lib/utils';

interface CartLine {
  item: CatalogItem;
  qty: number;
  /** Texto cru do campo: guardar número aqui apagaria o separador decimal
   *  enquanto o operador digita ("10," volta a "10"). */
  price: string;
}

type Tab = 'sell' | 'history';

function unitPriceOf(line: CartLine): number {
  const n = Number(line.price);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Serviço não tem teto; produto não pode passar do saldo em estoque. */
function availableFor(item: CatalogItem): number {
  return item.kind === 'product' ? Number(item.stock_qty) : Infinity;
}

export default function PosPage() {
  const t = useTranslations('Pos');
  const canSell = useCan('send-messages');

  const [tab, setTab] = useState<Tab>('sell');
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>('pix');
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState('0');
  const [contactId, setContactId] = useState('');
  const [contactQuery, setContactQuery] = useState('');
  const [contactOptions, setContactOptions] = useState<
    { id: string; name: string | null; phone: string }[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [refundSaleId, setRefundSaleId] = useState<string | null>(null);
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState<
    'all' | Sale['status']
  >('all');

  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/catalog?active=true');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('catalogError'));
      setCatalog(data.items ?? []);
      setCatalogError(null);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : t('catalogError'));
    }
  }, [t]);

  const loadSales = useCallback(async () => {
    setSales(null);
    try {
      const res = await fetch('/api/sales?limit=40');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('historyError'));
      setSales(data.sales ?? []);
      setSalesError(null);
    } catch (err) {
      setSalesError(err instanceof Error ? err.message : t('historyError'));
    }
  }, [t]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const q = contactQuery.trim();
    if (q.length < 2) {
      setContactOptions([]);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase
        .from('contacts')
        .select('id, name, phone')
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(8);
      if (!cancelled) setContactOptions(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [contactQuery]);

  useEffect(() => {
    if (tab === 'history') void loadSales();
  }, [tab, loadSales]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog ?? [];
    return (catalog ?? []).filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.sku ?? '').toLowerCase().includes(q)
    );
  }, [catalog, search]);

  const subtotal = useMemo(
    () =>
      Math.round(cart.reduce((s, l) => s + unitPriceOf(l) * l.qty, 0) * 100) /
      100,
    [cart]
  );

  const discountPreview = useMemo(() => {
    const raw = Number(discountValue);
    const value = Number.isFinite(raw) ? raw : 0;
    const r = computeDiscountAmount(subtotal, discountType, value);
    if (!r.ok) {
      return { amount: 0, value: 0, total: subtotal };
    }
    return {
      amount: r.discount_amount,
      value: r.discount_value,
      total: Math.round((subtotal - r.discount_amount) * 100) / 100,
    };
  }, [subtotal, discountType, discountValue]);

  const statusCounts = useMemo(() => {
    const base = {
      all: sales?.length ?? 0,
      confirmed: 0,
      partially_refunded: 0,
      cancelled: 0,
    };
    for (const s of sales ?? []) base[s.status] += 1;
    return base;
  }, [sales]);

  const visibleSales = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return (sales ?? []).filter((s) => {
      if (historyStatus !== 'all' && s.status !== historyStatus) return false;
      if (!q) return true;
      return (
        formatSaleCode(s.code).toLowerCase().includes(q) ||
        (s.contact?.name ?? '').toLowerCase().includes(q)
      );
    });
  }, [sales, historySearch, historyStatus]);

  function paymentLabel(method: PaymentMethod) {
    switch (method) {
      case 'pix':
        return t('payPix');
      case 'cash':
        return t('payCash');
      case 'card':
        return t('payCard');
      case 'other':
        return t('payOther');
    }
  }

  function statusLabel(status: Sale['status'] | undefined) {
    switch (status) {
      case 'partially_refunded':
        return t('statusPartial');
      case 'cancelled':
        return t('statusCancelled');
      default:
        return t('statusConfirmed');
    }
  }

  function setQty(itemId: string, qty: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.item.id === itemId ? { ...l, qty } : l))
        .filter((l) => l.qty > 0)
    );
  }

  function addToCart(item: CatalogItem) {
    const max = availableFor(item);
    const current = cart.find((l) => l.item.id === item.id)?.qty ?? 0;
    if (current + 1 > max) {
      toast.error(t('maxStock', { name: item.name, qty: formatNumber(max) }));
      return;
    }
    setCart((prev) =>
      current > 0
        ? prev.map((l) =>
            l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l
          )
        : [...prev, { item, qty: 1, price: String(Number(item.unit_price)) }]
    );
  }

  async function confirmSale() {
    if (!canSell || cart.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: payment,
          contact_id: contactId.trim() || null,
          discount_type: discountType,
          discount_value:
            discountType === 'none' ? 0 : Number(discountValue) || 0,
          lines: cart.map((l) => ({
            catalog_item_id: l.item.id,
            qty: l.qty,
            unit_price: unitPriceOf(l),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('saleError'));
      const code = formatSaleCode(
        (data.sale as Sale | undefined)?.code ?? ''
      );
      toast.success(t('saleOk', { code }));
      setCart([]);
      setDiscountType('none');
      setDiscountValue('0');
      setContactId('');
      setContactQuery('');
      void loadCatalog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('saleError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('subtitle')}</p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="gap-4"
      >
        {/* `min-h-10` (não `h-10`) porque a altura da lista vem de um
            group-variant que venceria um `h-*` passado aqui. */}
        <TabsList className="min-h-10 w-full sm:min-h-8 sm:w-fit">
          <TabsTrigger value="sell">{t('tabSell')}</TabsTrigger>
          <TabsTrigger value="history">{t('tabHistory')}</TabsTrigger>
        </TabsList>

        <TabsContent value="sell">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-2">
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="border-border bg-card h-9 pr-9 pl-8 text-base md:text-sm"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label={t('clearSearch')}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded transition-colors after:absolute after:-inset-2"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {catalogError ? (
                <StateCard
                  tone="destructive"
                  icon={<AlertCircle />}
                  title={t('catalogError')}
                  description={catalogError}
                  action={
                    <Button
                      variant="outline"
                      onClick={() => void loadCatalog()}
                    >
                      <RotateCcw className="size-4" />
                      {t('retry')}
                    </Button>
                  }
                />
              ) : catalog === null ? (
                <ul
                  aria-busy
                  className="bg-card ring-foreground/10 space-y-1 rounded-xl p-1 ring-1"
                >
                  {[0, 1, 2, 3, 4].map((i) => (
                    <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="bg-muted size-8 shrink-0 animate-pulse rounded-md" />
                      <span className="bg-muted h-3.5 w-40 max-w-[50%] animate-pulse rounded" />
                      <span className="bg-muted ml-auto h-3.5 w-14 animate-pulse rounded" />
                    </li>
                  ))}
                </ul>
              ) : catalog.length === 0 ? (
                <StateCard
                  tone="primary"
                  icon={<Package />}
                  title={t('catalogEmptyTitle')}
                  description={t('catalogEmptyDesc')}
                  action={
                    <Link
                      href="/catalog"
                      className={cn(buttonVariants({ variant: 'outline' }))}
                    >
                      {t('goToCatalog')}
                    </Link>
                  }
                />
              ) : filtered.length === 0 ? (
                <StateCard
                  tone="muted"
                  icon={<SearchX />}
                  title={t('noResults', { query: search.trim() })}
                  action={
                    <Button variant="outline" onClick={() => setSearch('')}>
                      {t('clearSearch')}
                    </Button>
                  }
                />
              ) : (
                <ul className="bg-card ring-foreground/10 max-h-[52dvh] space-y-1 overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl p-1 ring-1 lg:max-h-[62dvh]">
                  {filtered.map((item) => {
                    const isProduct = item.kind === 'product';
                    const KindIcon = isProduct ? Package : GraduationCap;
                    const soldOut = isProduct && Number(item.stock_qty) <= 0;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          disabled={!canSell || soldOut}
                          onClick={() => addToCart(item)}
                          aria-label={t('addAria', { name: item.name })}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                            !canSell || soldOut
                              ? 'opacity-60'
                              : 'hover:bg-card-2'
                          )}
                        >
                          <span
                            aria-hidden
                            className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md"
                          >
                            <KindIcon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="text-foreground block truncate text-sm font-medium">
                              {item.name}
                            </span>
                            <span className="text-muted-foreground block truncate text-xs">
                              {isProduct
                                ? soldOut
                                  ? t('outOfStock')
                                  : t('stock', {
                                      qty: formatNumber(item.stock_qty),
                                    })
                                : (item.sku ?? '')}
                            </span>
                          </span>
                          <span className="text-foreground shrink-0 text-sm font-semibold tabular-nums">
                            {formatCurrency(item.unit_price)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl p-4 ring-1">
              <div className="flex items-center gap-2">
                <ShoppingCart
                  aria-hidden
                  className="text-muted-foreground size-4"
                />
                <span className="text-foreground text-sm font-semibold">
                  {t('cart')}
                </span>
                {cart.length > 0 && (
                  <Badge variant="secondary" className="ml-auto tabular-nums">
                    {t('lines', { count: cart.length })}
                  </Badge>
                )}
              </div>

              {cart.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  {t('cartEmpty')}
                </p>
              ) : (
                <ul className="divide-border divide-y">
                  {cart.map((line) => {
                    const max = availableFor(line.item);
                    return (
                      <li
                        key={line.item.id}
                        className="flex items-start gap-2 py-2.5 first:pt-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground truncate text-sm font-medium">
                            {line.item.name}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-muted-foreground text-xs">
                              R$
                            </span>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={line.price}
                              aria-label={t('unitPriceAria', {
                                name: line.item.name,
                              })}
                              onChange={(e) =>
                                setCart((prev) =>
                                  prev.map((l) =>
                                    l.item.id === line.item.id
                                      ? { ...l, price: e.target.value }
                                      : l
                                  )
                                )
                              }
                              className="h-8 w-24 text-base tabular-nums md:text-sm"
                            />
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-foreground text-sm font-semibold tabular-nums">
                            {formatCurrency(unitPriceOf(line) * line.qty)}
                          </span>
                          <div className="flex items-center gap-0.5">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              aria-label={t('decreaseAria', {
                                name: line.item.name,
                              })}
                              onClick={() => setQty(line.item.id, line.qty - 1)}
                            >
                              <Minus className="size-3.5" />
                            </Button>
                            <span className="w-8 text-center text-sm tabular-nums">
                              {line.qty}
                            </span>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              disabled={line.qty >= max}
                              aria-label={t('increaseAria', {
                                name: line.item.name,
                              })}
                              onClick={() => setQty(line.item.id, line.qty + 1)}
                            >
                              <Plus className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label={t('removeAria', {
                                name: line.item.name,
                              })}
                              onClick={() =>
                                setCart((prev) =>
                                  prev.filter((l) => l.item.id !== line.item.id)
                                )
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="space-y-1.5">
                <Label>{t('payment')}</Label>
                <Select
                  value={payment}
                  onValueChange={(v) => v && setPayment(v as PaymentMethod)}
                >
                  <SelectTrigger className="w-full">
                    {/* Sem children o primitivo mostra o valor cru do enum
                        ("pix"); o rótulo traduzido vem daqui. */}
                    <SelectValue>{paymentLabel(payment)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">{t('payPix')}</SelectItem>
                    <SelectItem value="cash">{t('payCash')}</SelectItem>
                    <SelectItem value="card">{t('payCard')}</SelectItem>
                    <SelectItem value="other">{t('payOther')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pos-contact">{t('contactOptional')}</Label>
                <div className="relative">
                  <Input
                    id="pos-contact"
                    value={contactQuery}
                    onChange={(e) => {
                      setContactQuery(e.target.value);
                      setContactId('');
                    }}
                    placeholder={t('contactPlaceholder')}
                    className="pr-9 text-base md:text-sm"
                  />
                  {contactQuery && (
                    <button
                      type="button"
                      aria-label={t('clearContact')}
                      onClick={() => {
                        setContactQuery('');
                        setContactId('');
                        setContactOptions([]);
                      }}
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded transition-colors after:absolute after:-inset-2"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                {contactOptions.length > 0 && (
                  <ul className="divide-border ring-border max-h-36 divide-y overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg ring-1">
                    {contactOptions.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="hover:bg-muted w-full px-3 py-2 text-left text-sm transition-colors"
                          onClick={() => {
                            setContactId(c.id);
                            setContactQuery(c.name || c.phone);
                            setContactOptions([]);
                          }}
                        >
                          <span className="text-foreground">
                            {c.name || c.phone}
                          </span>
                          {c.name && (
                            <span className="text-muted-foreground">
                              {' · '}
                              {c.phone}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-muted-foreground text-sm">
                  {contactId ? t('contactSelected') : t('contactHint')}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>{t('discount')}</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div
                    role="group"
                    aria-label={t('discount')}
                    className="bg-muted flex items-center gap-1 rounded-lg p-[3px]"
                  >
                    {(
                      [
                        ['none', t('discountNone')],
                        ['fixed', t('discountFixed')],
                        ['percent', t('discountPercent')],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={discountType === value}
                        onClick={() => {
                          setDiscountType(value);
                          if (value === 'none') setDiscountValue('0');
                        }}
                        className={cn(
                          'inline-flex min-h-8 flex-1 items-center justify-center rounded-md px-2.5 text-sm font-medium transition-colors sm:flex-none',
                          discountType === value
                            ? 'bg-background text-foreground shadow-sm dark:bg-input/40'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {discountType !== 'none' && (
                    <Input
                      type="number"
                      min={0}
                      max={discountType === 'percent' ? 100 : undefined}
                      step={discountType === 'percent' ? '1' : '0.01'}
                      value={discountValue}
                      aria-label={t('discountValueAria')}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="h-8 w-full text-base tabular-nums sm:w-28 md:text-sm"
                    />
                  )}
                </div>
              </div>

              <div className="border-border mt-auto space-y-2 border-t pt-3">
                <div className="text-muted-foreground flex items-center justify-between gap-3 text-sm">
                  <span>{t('subtotal')}</span>
                  <span className="tabular-nums">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                {discountPreview.amount > 0 && (
                  <div className="text-muted-foreground flex items-center justify-between gap-3 text-sm">
                    <span>
                      {t('discountLine')}
                      {discountType === 'percent'
                        ? ` (${discountPreview.value}%)`
                        : ''}
                    </span>
                    <span className="tabular-nums">
                      −{formatCurrency(discountPreview.amount)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-xs">{t('total')}</p>
                    <p className="text-foreground text-lg font-semibold tabular-nums">
                      {formatCurrency(discountPreview.total)}
                    </p>
                  </div>
                  <GatedButton
                    canAct={canSell && cart.length > 0}
                    gateReason="registrar vendas"
                    disabled={saving}
                    onClick={() => void confirmSale()}
                  >
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    {t('confirm')}
                  </GatedButton>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {salesError ? (
            <StateCard
              tone="destructive"
              icon={<AlertCircle />}
              title={t('historyError')}
              description={salesError}
              action={
                <Button variant="outline" onClick={() => void loadSales()}>
                  <RotateCcw className="size-4" />
                  {t('retry')}
                </Button>
              }
            />
          ) : sales === null ? (
            <div
              aria-busy
              className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">
                      {t('colCode')}
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      {t('colContact')}
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      {t('colStatus')}
                    </TableHead>
                    <TableHead className="text-muted-foreground hidden lg:table-cell">
                      {t('colDate')}
                    </TableHead>
                    <TableHead className="text-muted-foreground text-right">
                      {t('colTotal')}
                    </TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[0, 1, 2, 3].map((i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell>
                        <span className="block h-3.5 w-16 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <span className="block h-3.5 w-28 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <span className="block h-3 w-20 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="block h-3 w-24 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <span className="ml-auto block h-3.5 w-16 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : sales.length === 0 ? (
            <StateCard
              tone="muted"
              icon={<Receipt />}
              title={t('historyEmptyTitle')}
              description={t('historyEmpty')}
            />
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:max-w-sm sm:flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder={t('historySearchPlaceholder')}
                    className="h-9 border-border bg-card pr-9 pl-8 text-base sm:h-8 md:text-sm"
                  />
                  {historySearch && (
                    <button
                      type="button"
                      onClick={() => setHistorySearch('')}
                      aria-label={t('clearSearch')}
                      className="absolute top-1/2 right-2 -translate-y-1/2 rounded text-muted-foreground transition-colors after:absolute after:-inset-2 hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                <div
                  role="group"
                  aria-label={t('statusFilterAria')}
                  className="flex items-center gap-1 overflow-x-auto rounded-lg bg-muted p-[3px] sm:ml-auto"
                >
                  {(
                    [
                      ['all', t('statusAll')],
                      ['confirmed', t('statusConfirmed')],
                      ['partially_refunded', t('statusPartial')],
                      ['cancelled', t('statusCancelled')],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={historyStatus === value}
                      onClick={() => setHistoryStatus(value)}
                      className={cn(
                        'inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors sm:min-h-7 sm:flex-none',
                        historyStatus === value
                          ? 'bg-background text-foreground shadow-sm dark:bg-input/40'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {label}
                      <span className="text-xs tabular-nums opacity-60">
                        {statusCounts[value]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {visibleSales.length === 0 ? (
                <StateCard
                  tone="muted"
                  icon={<SearchX />}
                  title={t('noResultsTitle')}
                  description={t('noResultsDesc')}
                  action={
                    <Button
                      variant="outline"
                      onClick={() => {
                        setHistorySearch('');
                        setHistoryStatus('all');
                      }}
                    >
                      {t('clearFilters')}
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground">
                          {t('colCode')}
                        </TableHead>
                        <TableHead className="text-muted-foreground">
                          {t('colContact')}
                        </TableHead>
                        <TableHead className="text-muted-foreground">
                          {t('colStatus')}
                        </TableHead>
                        <TableHead className="text-muted-foreground hidden lg:table-cell">
                          {t('colDate')}
                        </TableHead>
                        <TableHead className="text-muted-foreground text-right">
                          {t('colTotal')}
                        </TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleSales.map((sale) => {
                        const cancelled = sale.status === 'cancelled';
                        const partial =
                          sale.status === 'partially_refunded';
                        const refundedTotal = (sale.refunds ?? []).reduce(
                          (sum, r) => sum + Number(r.total_refunded),
                          0
                        );
                        const netTotal = Math.max(
                          0,
                          Number(sale.total) - refundedTotal
                        );
                        return (
                          <TableRow
                            key={sale.id}
                            onClick={() => setDetailSaleId(sale.id)}
                            className={cn(
                              'border-border cursor-pointer',
                              cancelled && 'opacity-60'
                            )}
                          >
                            <TableCell className="font-mono text-sm font-semibold tabular-nums text-foreground">
                              #{formatSaleCode(sale.code)}
                            </TableCell>
                            <TableCell>
                              <span className="block max-w-[10rem] truncate text-sm font-medium text-foreground">
                                {sale.contact?.name || t('noContact')}
                              </span>
                              <span className="text-muted-foreground text-xs lg:hidden">
                                {formatDateTime(sale.created_at)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={partial ? 'secondary' : 'outline'}
                                className={cn(
                                  'shrink-0',
                                  !partial && 'text-muted-foreground'
                                )}
                              >
                                {statusLabel(sale.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                              {formatDateTime(sale.created_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              {partial ? (
                                <div className="flex flex-col items-end leading-tight">
                                  <span className="text-muted-foreground text-xs tabular-nums line-through">
                                    {formatCurrency(sale.total)}
                                  </span>
                                  <span className="text-sm font-semibold tabular-nums text-foreground">
                                    {formatCurrency(netTotal)}
                                  </span>
                                </div>
                              ) : (
                                <span
                                  className={cn(
                                    'text-sm font-semibold tabular-nums text-foreground',
                                    cancelled && 'line-through'
                                  )}
                                >
                                  {formatCurrency(sale.total)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  aria-label={t('rowActions')}
                                  className="text-muted-foreground hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted inline-flex size-9 shrink-0 items-center justify-center rounded-md transition-colors sm:size-8"
                                >
                                  <MoreVertical className="size-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => setDetailSaleId(sale.id)}
                                  >
                                    <Eye className="size-4" />
                                    {t('detailsAction')}
                                  </DropdownMenuItem>
                                  {canSell && !cancelled && (
                                    <DropdownMenuItem
                                      onClick={() => setRefundSaleId(sale.id)}
                                    >
                                      <Undo2 className="size-4" />
                                      {t('refundAction')}
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <SaleRefundDialog
        saleId={refundSaleId}
        open={!!refundSaleId}
        onOpenChange={(o) => !o && setRefundSaleId(null)}
        onDone={() => {
          void loadSales();
          void loadCatalog();
        }}
      />

      <SaleDetailDialog
        saleId={detailSaleId}
        open={!!detailSaleId}
        onOpenChange={(o) => !o && setDetailSaleId(null)}
      />
    </div>
  );
}
