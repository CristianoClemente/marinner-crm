"use client";

import { memo } from "react";
import type { Deal, PipelineStage } from "@/types";
import { Calendar, Check, X } from "lucide-react";
import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface DealCardProps {
  deal: Deal;
  stage: PipelineStage | null;
  onEdit: (deal: Deal) => void;
  isOverlay?: boolean;
}

function formatDueDate(dateStr: string): string {
  return formatDate(dateStr, {
    day: "2-digit",
    month: "short",
  });
}

function initials(name?: string, fallback?: string) {
  const source = (name || fallback || "?").trim();
  if (!source) return "?";
  return source.charAt(0).toUpperCase();
}

export const DealCard = memo(function DealCard({
  deal,
  stage,
  onEdit,
  isOverlay,
}: DealCardProps) {
  const t = useTranslations("Pipelines.card");
  const contactLabel =
    deal.contact?.name || deal.contact?.phone || t("noContact");
  const assigneeLabel = deal.assignee?.full_name || null;

  return (
    <button
      type="button"
      onClick={(e) => {
        // `onClick` still fires after a non-drag tap because the PointerSensor
        // requires 5px movement before it counts as a drag.
        if (isOverlay) return;
        e.stopPropagation();
        onEdit(deal);
      }}
      className={cn(
        "group relative w-full cursor-pointer rounded-lg border border-border bg-card py-2.5 pr-3 pl-3.5 text-left transition-colors",
        isOverlay
          ? "shadow-md"
          : "hover:border-border hover:bg-muted/60",
      )}
    >
      <span
        aria-hidden
        className="absolute top-0 left-0 h-full w-0.75 rounded-l-lg"
        style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
      />

      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 flex-1 text-sm font-medium leading-snug wrap-break-word text-foreground">
          {deal.title}
        </h4>
        {deal.status === "won" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            <Check className="size-3" />
            {t("won")}
          </span>
        )}
        {deal.status === "lost" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
            <X className="size-3" />
            {t("lost")}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
          {initials(deal.contact?.name, deal.contact?.phone)}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {contactLabel}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(deal.value, deal.currency || DEFAULT_CURRENCY)}
        </span>
        {deal.expected_close_date && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="size-3" />
            {formatDueDate(deal.expected_close_date)}
          </span>
        )}
      </div>

      {assigneeLabel && (
        <div className="mt-2 flex items-center justify-end">
          <span
            title={assigneeLabel}
            className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground"
          >
            {initials(assigneeLabel)}
          </span>
        </div>
      )}
    </button>
  );
});
