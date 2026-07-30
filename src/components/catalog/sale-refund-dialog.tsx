"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { formatCurrency } from "@/lib/currency";
import { formatSaleCode } from "@/lib/sales/code";
import { prepareRefund } from "@/lib/sales/refund";
import type { Sale, SaleItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
interface SaleRefundDialogProps {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

export function SaleRefundDialog({
  saleId,
  open,
  onOpenChange,
  onDone,
}: SaleRefundDialogProps) {
  const t = useTranslations("Pos.refund");
  const [sale, setSale] = useState<Sale | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qtyByItem, setQtyByItem] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !saleId) return;
    setSale(null);
    setLoadError(null);
    setNote("");
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/sales/${saleId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("loadError"));
        if (cancelled) return;
        const s = data.sale as Sale;
        setSale(s);
        // Nada pré-selecionado: o operador marca o que quer estornar.
        setQtyByItem({});
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : t("loadError"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, saleId, t]);

  const refundableItems = useMemo(
    () =>
      (sale?.items ?? []).filter(
        (i) => (i.qty_remaining ?? Number(i.qty)) > 0,
      ),
    [sale],
  );

  const preview = useMemo(() => {
    if (!sale) return null;
    const lines = refundableItems
      .map((i) => ({
        sale_item_id: i.id,
        qty: qtyByItem[i.id] ?? 0,
      }))
      .filter((l) => l.qty > 0);

    const refundedQtyByItemId = new Map<string, number>();
    for (const i of sale.items ?? []) {
      const done = i.qty_refunded ?? 0;
      if (done > 0) refundedQtyByItemId.set(i.id, done);
    }
    const discountAlreadyRefunded = (sale.refunds ?? []).reduce(
      (s, r) => s + Number(r.discount_refunded),
      0,
    );

    return prepareRefund({
      sale,
      items: (sale.items ?? []) as SaleItem[],
      refundedQtyByItemId,
      discountAlreadyRefunded,
      lines,
    });
  }, [sale, qtyByItem, refundableItems]);

  const allSelected =
    refundableItems.length > 0 &&
    refundableItems.every((i) => (qtyByItem[i.id] ?? 0) > 0);

  function setAllRemaining() {
    const next: Record<string, number> = {};
    for (const item of refundableItems) {
      next[item.id] = item.qty_remaining ?? Number(item.qty);
    }
    setQtyByItem(next);
  }

  function clearSelection() {
    setQtyByItem({});
  }

  async function confirm() {
    if (!saleId || !preview?.ok) return;
    setSaving(true);
    try {
      const lines = preview.items.map((i) => ({
        sale_item_id: i.sale_item_id,
        qty: i.qty,
      }));
      const res = await fetch(`/api/sales/${saleId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: note.trim() || null,
          lines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("error"));
      toast.success(
        t("ok", { code: formatSaleCode(sale?.code ?? "") }),
      );
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("title", {
              code: formatSaleCode(sale?.code ?? ""),
            })}
          </DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : !sale ? (
          <div className="space-y-2 py-4" aria-busy>
            <span className="block h-3.5 w-40 animate-pulse rounded bg-muted" />
            <span className="block h-3 w-28 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="max-h-[60dvh] space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain">
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={allSelected ? clearSelection : setAllRemaining}
              >
                {allSelected ? t("clearSelection") : t("selectAll")}
              </Button>
            </div>

            <ul className="divide-y divide-border">
              {refundableItems.map((item) => {
                const rem = item.qty_remaining ?? Number(item.qty);
                const qty = qtyByItem[item.id] ?? 0;
                const selected = qty > 0;
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 py-2.5 first:pt-0"
                  >
                    <Checkbox
                      id={`refund-item-${item.id}`}
                      checked={selected}
                      onCheckedChange={(checked) =>
                        setQtyByItem((prev) => ({
                          ...prev,
                          [item.id]: checked ? rem : 0,
                        }))
                      }
                    />
                    <label
                      htmlFor={`refund-item-${item.id}`}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <span className="block truncate text-sm font-medium text-foreground">
                        {item.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatCurrency(item.unit_price)} ·{" "}
                        {t("remaining", { qty: rem })}
                      </span>
                    </label>
                    {selected && rem > 1 && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          disabled={qty <= 1}
                          aria-label={t("decreaseAria", { name: item.name })}
                          onClick={() =>
                            setQtyByItem((prev) => ({
                              ...prev,
                              [item.id]: Math.max(1, (prev[item.id] ?? 0) - 1),
                            }))
                          }
                        >
                          <Minus className="size-3.5" />
                        </Button>
                        <span className="w-8 text-center text-sm tabular-nums">
                          {qty}
                        </span>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          disabled={qty >= rem}
                          aria-label={t("increaseAria", { name: item.name })}
                          onClick={() =>
                            setQtyByItem((prev) => ({
                              ...prev,
                              [item.id]: Math.min(rem, (prev[item.id] ?? 0) + 1),
                            }))
                          }
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="space-y-1.5">
              <Label htmlFor="refund-note">{t("note")}</Label>
              <Input
                id="refund-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("notePlaceholder")}
                className="text-base md:text-sm"
              />
            </div>

            {!preview?.ok ? (
              <p className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                {t("nothingSelected")}
              </p>
            ) : (
              <div className="space-y-1 rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
                <div className="flex justify-between gap-2 text-muted-foreground">
                  <span>{t("subtotal")}</span>
                  <span className="tabular-nums">
                    {formatCurrency(preview.subtotal_refunded)}
                  </span>
                </div>
                {preview.discount_refunded > 0 && (
                  <div className="flex justify-between gap-2 text-muted-foreground">
                    <span>{t("discount")}</span>
                    <span className="tabular-nums">
                      −{formatCurrency(preview.discount_refunded)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-2 font-semibold text-foreground">
                  <span>{t("total")}</span>
                  <span className="tabular-nums">
                    {formatCurrency(preview.total_refunded)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={saving || !preview?.ok}
            onClick={() => void confirm()}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? t("saving") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
