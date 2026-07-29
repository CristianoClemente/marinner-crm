"use client";

import { memo, useMemo, useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Deal, PipelineStage } from "@/types";
import { DealCard } from "./deal-card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency";
import { useTranslations } from "next-intl";
import { usePipelineLabels } from "@/hooks/use-pipeline-labels";
import { cn } from "@/lib/utils";

interface PipelineBoardProps {
  stages: PipelineStage[];
  deals: Deal[];
  onDealMoved: (dealId: string, newStageId: string) => void;
  onAddDeal: (stageId: string) => void;
  onEditDeal: (deal: Deal) => void;
}

interface StageBucket {
  deals: Deal[];
  totalValue: number;
}

const EMPTY_BUCKET: StageBucket = { deals: [], totalValue: 0 };

export function PipelineBoard({
  stages,
  deals,
  onDealMoved,
  onAddDeal,
  onEditDeal,
}: PipelineBoardProps) {
  const { defaultCurrency } = useAuth();
  const [activeDealId, setActiveDealId] = useState<string | null>(null);

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages],
  );

  const dealsByStage = useMemo(() => {
    const map = new Map<string, StageBucket>();
    for (const stage of sortedStages) {
      map.set(stage.id, { deals: [], totalValue: 0 });
    }
    for (const deal of deals) {
      const bucket = map.get(deal.stage_id);
      if (!bucket) continue;
      bucket.deals.push(deal);
      bucket.totalValue += Number(deal.value || 0);
    }
    return map;
  }, [sortedStages, deals]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const activeDeal = activeDealId
    ? (deals.find((d) => d.id === activeDealId) ?? null)
    : null;

  const activeStage = useMemo(() => {
    if (!activeDeal) return null;
    return sortedStages.find((s) => s.id === activeDeal.stage_id) ?? null;
  }, [activeDeal, sortedStages]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDealId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDealId(null);
      const { active, over } = event;
      if (!over) return;
      const dealId = String(active.id);
      const targetStageId = String(over.id);

      const deal = deals.find((d) => d.id === dealId);
      if (!deal || deal.stage_id === targetStageId) return;
      if (!sortedStages.some((s) => s.id === targetStageId)) return;

      onDealMoved(dealId, targetStageId);
    },
    [deals, sortedStages, onDealMoved],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDealId(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="pipeline-scroll flex h-full min-h-0 snap-x snap-mandatory gap-3 overflow-x-auto lg:snap-none">
        {sortedStages.map((stage) => {
          const bucket = dealsByStage.get(stage.id) ?? EMPTY_BUCKET;
          return (
            <StageColumn
              key={stage.id}
              stage={stage}
              deals={bucket.deals}
              totalValue={bucket.totalValue}
              currency={defaultCurrency}
              onAddDeal={onAddDeal}
              onEditDeal={onEditDeal}
            />
          );
        })}
      </div>

      <DragOverlay
        dropAnimation={{
          duration: 200,
          easing: "cubic-bezier(0.2, 0, 0, 1)",
        }}
      >
        {activeDeal ? (
          <div className="opacity-90">
            <DealCard
              deal={activeDeal}
              stage={activeStage}
              onEdit={() => {}}
              isOverlay
            />
          </div>
        ) : null}
      </DragOverlay>

      <style jsx>{`
        .pipeline-scroll {
          scroll-behavior: smooth;
        }
        /* Touch: esconde a barra — o snap horizontal já guia o gesto.
           Desktop herda o scroll discreto global de globals.css. */
        @media (hover: none), (pointer: coarse) {
          .pipeline-scroll::-webkit-scrollbar {
            height: 0;
            display: none;
          }
          .pipeline-scroll {
            scrollbar-width: none;
          }
        }
      `}</style>
    </DndContext>
  );
}

const StageColumn = memo(function StageColumn({
  stage,
  deals,
  totalValue,
  currency,
  onAddDeal,
  onEditDeal,
}: {
  stage: PipelineStage;
  deals: Deal[];
  totalValue: number;
  currency: string;
  onAddDeal: (stageId: string) => void;
  onEditDeal: (deal: Deal) => void;
}) {
  const t = useTranslations("Pipelines.board");
  const { stageLabel } = usePipelineLabels();
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex h-full w-[85vw] min-w-65 max-w-80 shrink-0 snap-start flex-col rounded-lg border border-border bg-muted/40 p-3 lg:w-auto lg:max-w-none lg:min-w-65 lg:flex-1 lg:basis-65 lg:shrink lg:snap-none">
      <div
        className="-mx-3 -mt-3 mb-3 h-0.75 shrink-0 rounded-t-lg"
        style={{ backgroundColor: stage.color }}
      />
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-foreground">
            {stageLabel(stage.name)}
          </h3>
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            {formatCurrency(totalValue, currency)}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-background px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {deals.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-md transition-colors",
          isOver ? "bg-primary/5 ring-1 ring-dashed ring-primary/40" : "",
        )}
      >
        {deals.length === 0 ? (
          <div className="flex min-h-32 flex-1 items-center justify-center rounded-md border border-dashed border-border/80 px-2 py-8 text-center text-xs text-muted-foreground">
            {t("dropDealHere")}
          </div>
        ) : (
          deals.map((deal) => (
            <DraggableDealCard
              key={deal.id}
              deal={deal}
              stage={stage}
              onEdit={onEditDeal}
            />
          ))
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onAddDeal(stage.id)}
        className="mt-2 h-8 w-full shrink-0 justify-start border border-dashed border-border bg-transparent text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Plus className="size-3.5" />
        {t("addDeal")}
      </Button>
    </div>
  );
});

const DraggableDealCard = memo(function DraggableDealCard({
  deal,
  stage,
  onEdit,
}: {
  deal: Deal;
  stage: PipelineStage;
  onEdit: (deal: Deal) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="shrink-0 [content-visibility:auto] [contain-intrinsic-size:auto_7rem]"
      style={{ opacity: isDragging ? 0.3 : 1, touchAction: "none" }}
    >
      <DealCard deal={deal} stage={stage} onEdit={onEdit} />
    </div>
  );
});
