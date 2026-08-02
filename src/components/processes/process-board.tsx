"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Check,
  ChevronRight,
  MessageSquare,
  MoreVertical,
  UserRound,
  X,
} from "lucide-react";

import { useWhatsAppProvider } from "@/hooks/use-whatsapp-provider";
import { sortStages } from "@/lib/processes/advance";
import {
  processContactLabel,
  processContactMeta,
} from "@/lib/processes/contact-label";
import type { EnrollmentProcess, ProcessTemplateStage } from "@/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProcessActionKind } from "./process-action-dialog";

/** Bucket dos processos cuja etapa atual não pertence mais ao template. */
const NO_STAGE = "__sem_etapa__";

interface ProcessBoardProps {
  stages: ProcessTemplateStage[];
  processes: EnrollmentProcess[];
  canOperate: boolean;
  pendingByProcessId?: Record<string, number>;
  onOpen: (process: EnrollmentProcess) => void;
  onViewContact: (contactId: string) => void;
  onAction: (process: EnrollmentProcess, kind: ProcessActionKind) => void;
}

export function ProcessBoard({
  stages,
  processes,
  canOperate,
  pendingByProcessId,
  onOpen,
  onViewContact,
  onAction,
}: ProcessBoardProps) {
  const t = useTranslations("Processes.list");
  const { provider, loading: providerLoading } = useWhatsAppProvider();
  const canOpenInbox = !providerLoading && provider !== null;

  const ordered = useMemo(() => sortStages(stages), [stages]);

  const byStage = useMemo(() => {
    const map = new Map<string, EnrollmentProcess[]>();
    for (const stage of ordered) map.set(stage.id, []);
    map.set(NO_STAGE, []);
    for (const process of processes) {
      const key =
        process.current_stage_id && map.has(process.current_stage_id)
          ? process.current_stage_id
          : NO_STAGE;
      map.get(key)?.push(process);
    }
    return map;
  }, [ordered, processes]);

  const orphans = byStage.get(NO_STAGE) ?? [];

  return (
    <div className="process-board flex h-full min-h-0 snap-x snap-mandatory gap-3 overflow-x-auto lg:snap-none">
      {ordered.map((stage, index) => (
        <StageColumn
          key={stage.id}
          title={stage.name}
          position={t("stageProgress", {
            current: index + 1,
            total: ordered.length,
          })}
          processes={byStage.get(stage.id) ?? []}
          canOperate={canOperate}
          canOpenInbox={canOpenInbox}
          pendingByProcessId={pendingByProcessId}
          onOpen={onOpen}
          onViewContact={onViewContact}
          onAction={onAction}
        />
      ))}
      {orphans.length > 0 ? (
        <StageColumn
          title={t("noStage")}
          processes={orphans}
          canOperate={canOperate}
          canOpenInbox={canOpenInbox}
          pendingByProcessId={pendingByProcessId}
          onOpen={onOpen}
          onViewContact={onViewContact}
          onAction={onAction}
        />
      ) : null}

      <style jsx>{`
        @media (hover: none), (pointer: coarse) {
          .process-board::-webkit-scrollbar {
            height: 0;
            display: none;
          }
          .process-board {
            scrollbar-width: none;
          }
        }
      `}</style>
    </div>
  );
}

function StageColumn({
  title,
  position,
  processes,
  canOperate,
  canOpenInbox,
  pendingByProcessId,
  onOpen,
  onViewContact,
  onAction,
}: {
  title: string;
  position?: string;
  processes: EnrollmentProcess[];
  canOperate: boolean;
  canOpenInbox: boolean;
  pendingByProcessId?: Record<string, number>;
  onOpen: (process: EnrollmentProcess) => void;
  onViewContact: (contactId: string) => void;
  onAction: (process: EnrollmentProcess, kind: ProcessActionKind) => void;
}) {
  const t = useTranslations("Processes.list");
  const tFields = useTranslations("Processes.fields");

  return (
    <section className="flex h-full w-[85vw] min-w-65 max-w-80 shrink-0 snap-start flex-col rounded-lg border border-border bg-muted/40 p-3 lg:w-auto lg:max-w-none lg:min-w-65 lg:flex-1 lg:basis-65 lg:shrink lg:snap-none">
      <div className="flex shrink-0 items-baseline justify-between gap-2">
        <h2 className="min-w-0 truncate text-sm font-medium text-foreground">
          {title}
        </h2>
        <span className="shrink-0 rounded-md bg-background px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {processes.length}
        </span>
      </div>
      {position ? (
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {position}
        </p>
      ) : null}

      <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {processes.length === 0 ? (
          <li className="flex min-h-32 flex-1 items-center justify-center rounded-md border border-dashed border-border/80 px-2 py-8 text-center text-xs text-muted-foreground">
            {t("emptyStage")}
          </li>
        ) : (
          processes.map((process) => (
            <ProcessCard
              key={process.id}
              process={process}
              canOperate={canOperate}
              canOpenInbox={canOpenInbox}
              pendingCount={pendingByProcessId?.[process.id]}
              pendingLabel={tFields("pendingCount", {
                count: pendingByProcessId?.[process.id] ?? 0,
              })}
              onOpen={onOpen}
              onViewContact={onViewContact}
              onAction={onAction}
            />
          ))
        )}
      </ul>
    </section>
  );
}

function ProcessCard({
  process,
  canOperate,
  canOpenInbox,
  pendingCount,
  pendingLabel,
  onOpen,
  onViewContact,
  onAction,
}: {
  process: EnrollmentProcess;
  canOperate: boolean;
  canOpenInbox: boolean;
  pendingCount?: number;
  pendingLabel: string;
  onOpen: (process: EnrollmentProcess) => void;
  onViewContact: (contactId: string) => void;
  onAction: (process: EnrollmentProcess, kind: ProcessActionKind) => void;
}) {
  const t = useTranslations("Processes.list");
  const router = useRouter();
  const [inboxBusy, setInboxBusy] = useState(false);
  const label = processContactLabel(process, t("contactFallback"));
  const meta = processContactMeta(process);
  const showFooter = canOperate || canOpenInbox;

  async function openInbox() {
    if (inboxBusy) return;
    setInboxBusy(true);
    try {
      const res = await fetch("/api/whatsapp/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: process.contact_id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string" ? json.error : t("openInboxFailed"),
        );
      }
      const conversationId = json.conversation?.id as string | undefined;
      if (!conversationId) throw new Error(t("openInboxFailed"));
      router.push(`/inbox?c=${conversationId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("openInboxFailed"));
    } finally {
      setInboxBusy(false);
    }
  }

  return (
    <li className="shrink-0 rounded-lg bg-card ring-1 ring-foreground/10">
      <button
        type="button"
        onClick={() => onOpen(process)}
        className="flex w-full flex-col items-start rounded-t-lg px-2.5 pt-2.5 pb-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="w-full truncate text-sm font-medium text-foreground">
          {label}
        </span>
        {meta ? (
          <span className="w-full truncate text-xs text-muted-foreground">
            {meta}
          </span>
        ) : null}
        {typeof pendingCount === "number" && pendingCount > 0 ? (
          <span className="mt-1 text-xs text-muted-foreground">
            {pendingLabel}
          </span>
        ) : null}
      </button>

      {showFooter ? (
        <div className="flex items-center justify-between gap-1 px-1.5 pb-1.5">
          {canOperate ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground hover:text-foreground sm:h-7"
              onClick={() => onAction(process, "advance")}
            >
              {t("advance")}
              <ChevronRight />
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-0.5">
            {canOpenInbox ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground sm:size-7"
                aria-label={t("openInbox")}
                title={t("openInbox")}
                disabled={inboxBusy}
                onClick={() => void openInbox()}
              >
                <MessageSquare className="size-4" />
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t("moreActions")}
                className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors after:absolute after:-inset-1 hover:bg-muted hover:text-foreground data-popup-open:bg-muted sm:size-7 sm:after:hidden"
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {canOperate ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => onAction(process, "complete")}
                    >
                      <Check />
                      {t("complete")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onAction(process, "cancel")}
                    >
                      <X />
                      {t("cancelProcess")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                {canOpenInbox ? (
                  <DropdownMenuItem
                    disabled={inboxBusy}
                    onClick={() => void openInbox()}
                  >
                    <MessageSquare />
                    {t("openInbox")}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onClick={() => onViewContact(process.contact_id)}
                >
                  <UserRound />
                  {t("viewContact")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : (
        <div className="pb-2.5" />
      )}
    </li>
  );
}
