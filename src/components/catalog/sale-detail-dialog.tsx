"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { formatCurrency } from "@/lib/currency";
import { formatDateTime, formatNumber } from "@/lib/format";
import { formatSaleCode } from "@/lib/sales/code";
import type { PaymentMethod, Sale } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SaleDetailDialogProps {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaleDetailDialog({
  saleId,
  open,
  onOpenChange,
}: SaleDetailDialogProps) {
  const t = useTranslations("Pos.detail");
  const [sale, setSale] = useState<Sale | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !saleId) return;
    setSale(null);
    setLoadError(null);
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/sales/${saleId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("loadError"));
        if (!cancelled) setSale(data.sale as Sale);
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

  const refundedTotal = useMemo(
    () =>
      (sale?.refunds ?? []).reduce(
        (sum, r) => sum + Number(r.total_refunded),
        0,
      ),
    [sale],
  );

  function paymentLabel(method: PaymentMethod) {
    switch (method) {
      case "pix":
        return t("payPix");
      case "cash":
        return t("payCash");
      case "card":
        return t("payCard");
      case "other":
        return t("payOther");
    }
  }

  const status = sale?.status ?? "confirmed";
  const netTotal = sale
    ? Math.max(0, Number(sale.total) - refundedTotal)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{t("title", { code: formatSaleCode(sale?.code ?? "") })}</span>
            {sale && (
              <Badge
                variant={
                  status === "partially_refunded" ? "secondary" : "outline"
                }
                className="text-muted-foreground"
              >
                {status === "partially_refunded"
                  ? t("statusPartial")
                  : status === "cancelled"
                    ? t("statusCancelled")
                    : t("statusConfirmed")}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {sale
              ? `${sale.contact?.name || t("noContact")} · ${paymentLabel(sale.payment_method)} · ${formatDateTime(sale.created_at)}`
              : t("loading")}
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : !sale ? (
          <div className="space-y-2 py-4" aria-busy>
            <span className="block h-3.5 w-40 animate-pulse rounded bg-muted" />
            <span className="block h-3 w-28 animate-pulse rounded bg-muted" />
            <span className="block h-3 w-32 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="max-h-[60dvh] space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain">
            <ul className="divide-y divide-border">
              {(sale.items ?? []).map((item) => {
                const refunded = item.qty_refunded ?? 0;
                return (
                  <li key={item.id} className="flex gap-3 py-2.5 first:pt-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatNumber(item.qty)} × {formatCurrency(item.unit_price)}
                        {refunded > 0 && (
                          <span className="text-destructive">
                            {" "}
                            · {t("refundedQty", { qty: formatNumber(refunded) })}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums text-foreground">
                      {formatCurrency(item.line_total)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="space-y-1 rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
              <div className="flex justify-between gap-2 text-muted-foreground">
                <span>{t("subtotal")}</span>
                <span className="tabular-nums">
                  {formatCurrency(sale.subtotal)}
                </span>
              </div>
              {sale.discount_amount > 0 && (
                <div className="flex justify-between gap-2 text-muted-foreground">
                  <span>
                    {t("discount")}
                    {sale.discount_type === "percent"
                      ? ` (${formatNumber(sale.discount_value)}%)`
                      : ""}
                  </span>
                  <span className="tabular-nums">
                    −{formatCurrency(sale.discount_amount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-2 font-semibold text-foreground">
                <span>{t("total")}</span>
                <span className="tabular-nums">
                  {formatCurrency(sale.total)}
                </span>
              </div>
            </div>

            {(sale.refunds ?? []).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("refundsTitle")}
                </p>
                <ul className="space-y-2">
                  {(sale.refunds ?? []).map((refund) => (
                    <li
                      key={refund.id}
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(refund.created_at)}
                        </span>
                        <span className="font-medium tabular-nums text-destructive">
                          −{formatCurrency(refund.total_refunded)}
                        </span>
                      </div>
                      {refund.note && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {refund.note}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-sm font-semibold text-foreground">
                  <span>{t("netRemaining")}</span>
                  <span className="tabular-nums">
                    {formatCurrency(netTotal)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
