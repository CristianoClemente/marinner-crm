"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CONVERSATION_SELECT,
  matchesContactFilters,
  normalizeConversations,
} from "@/lib/inbox/conversations";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationStatus, Profile, Tag } from "@/types";
import { Search, ChevronDown, X, SquarePen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  conversations: Conversation[];
  onConversationsLoaded: (conversations: Conversation[]) => void;
  /**
   * Increment to force the fetch effect below to refire. The parent
   * bumps this on realtime reconnect / tab visibility → visible so the
   * list catches up on any events sent while the WS was disconnected
   * or the tab was throttled. Optional so existing callers keep working.
   */
  resyncToken?: number;
  /** Opens the "Nova mensagem" contact picker in the parent. */
  onNewMessage?: () => void;
}

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: "bg-primary",
  pending: "bg-amber-500",
  closed: "bg-muted-foreground",
};

const STATUS_LABEL_KEYS: Record<
  ConversationStatus,
  "statusOpen" | "statusPending" | "statusClosed"
> = {
  open: "statusOpen",
  pending: "statusPending",
  closed: "statusClosed",
};

type AssignmentFilter = "all" | "mine" | "unassigned";
type StatusFilter = "all" | ConversationStatus;

export function ConversationList({
  activeConversationId,
  onSelect,
  conversations,
  onConversationsLoaded,
  resyncToken = 0,
  onNewMessage,
}: ConversationListProps) {
  const t = useTranslations("Inbox.conversationList");
  const tNew = useTranslations("Inbox.newMessage");
  const { user } = useAuth();

  const ASSIGNMENT_OPTIONS: { label: string; value: AssignmentFilter }[] =
    useMemo(
      () => [
        { label: t("filterAll"), value: "all" },
        { label: t("filterMine"), value: "mine" },
        { label: t("filterUnassigned"), value: "unassigned" },
      ],
      [t],
    );

  const STATUS_FILTER_OPTIONS: { label: string; value: StatusFilter }[] =
    useMemo(
      () => [
        { label: t("filterAll"), value: "all" },
        { label: t("filterOpen"), value: "open" },
        { label: t("filterPending"), value: "pending" },
        { label: t("filterClosed"), value: "closed" },
      ],
      [t],
    );

  const [search, setSearch] = useState("");
  const [assignmentFilter, setAssignmentFilter] =
    useState<AssignmentFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  // Contact-based filters (issue #272). Tags use OR logic (a conversation
  // matches if its contact carries any selected tag), consistent with
  // Broadcast audience filtering.
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [profilesByUserId, setProfilesByUserId] = useState<
    Map<string, Profile>
  >(() => new Map());

  // Keep the latest callback in a ref so the fetch effect below can
  // have a stable, empty-dep identity. Previously the fetch useCallback
  // depended on `onConversationsLoaded`, which depends on the parent's
  // `deepLinkConvId` — so every URL change (including one the parent
  // triggered via router.replace after a click) caused a fresh
  // conversations fetch. That extra refetch was the trigger for the
  // deep-link auto-select running a second time and wiping the active
  // thread's messages.
  // Mutation lives in an effect (not render) per React 19's refs rule;
  // the fetch runs once on mount so it's fine to read the slightly
  // older value — the very next render updates the ref for any
  // subsequent async completion.
  const onConversationsLoadedRef = useRef(onConversationsLoaded);
  useEffect(() => {
    onConversationsLoadedRef.current = onConversationsLoaded;
  });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(CONVERSATION_SELECT)
        .order("last_message_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        // Supabase errors have non-enumerable properties — log fields explicitly
        console.error("Failed to fetch conversations:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        setLoading(false);
        return;
      }

      onConversationsLoadedRef.current(normalizeConversations(data ?? []));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // `resyncToken` is included so the parent can force a refetch when
    // the realtime channel reconnects or the tab regains focus — catches
    // up on any events sent while the WS was disconnected or throttled.
  }, [resyncToken]);

  // Tag definitions for the filter picker — loaded once so labels/colours
  // stay stable regardless of which conversations happen to be loaded.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("tags").select("*").order("name");
      if (!cancelled && data) setTags(data as Tag[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Nomes dos agentes atribuídos — um fetch para rotular as linhas da lista.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (cancelled) return;
      if (error) {
        console.error("Failed to fetch profiles for inbox list:", error);
        return;
      }
      const map = new Map<string, Profile>();
      for (const row of (data as Profile[]) ?? []) {
        map.set(row.user_id, row);
      }
      setProfilesByUserId(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tagsById = useMemo(() => {
    const m = new Map<string, Tag>();
    for (const tag of tags) m.set(tag.id, tag);
    return m;
  }, [tags]);

  const filtered = useMemo(() => {
    let result = conversations;
    const myId = user?.id;

    if (assignmentFilter === "mine") {
      result = result.filter(
        (c) => myId != null && c.assigned_agent_id === myId,
      );
    } else if (assignmentFilter === "unassigned") {
      result = result.filter((c) => !c.assigned_agent_id);
    }

    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }

    if (unreadOnly) {
      result = result.filter((c) => c.unread_count > 0);
    }

    // Contact-based filters (tags via OR logic).
    if (selectedTagIds.length > 0) {
      result = result.filter((c) =>
        matchesContactFilters(c, {
          tagIds: selectedTagIds,
        }),
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? "";
        const phone = c.contact?.phone?.toLowerCase() ?? "";
        const lastMsg = c.last_message_text?.toLowerCase() ?? "";
        return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
      });
    }

    return result;
  }, [
    conversations,
    assignmentFilter,
    statusFilter,
    unreadOnly,
    search,
    selectedTagIds,
    user?.id,
  ]);

  const toggleTag = useCallback((id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }, []);

  const clearContactFilters = useCallback(() => {
    setSelectedTagIds([]);
  }, []);

  const hasContactFilters = selectedTagIds.length > 0;
  const hasListFilters =
    assignmentFilter !== "all" ||
    statusFilter !== "all" ||
    unreadOnly ||
    hasContactFilters ||
    search.trim().length > 0;

  const clearAllListFilters = useCallback(() => {
    setAssignmentFilter("all");
    setStatusFilter("all");
    setUnreadOnly(false);
    setSearch("");
    setSelectedTagIds([]);
  }, []);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    [],
  );

  const handleSelect = useCallback(
    (conv: Conversation) => {
      onSelect(conv);
    },
    [onSelect],
  );

  const activeAssignment = ASSIGNMENT_OPTIONS.find(
    (o) => o.value === assignmentFilter,
  );
  const activeStatus = STATUS_FILTER_OPTIONS.find(
    (o) => o.value === statusFilter,
  );

  return (
    // w-full on mobile so the list occupies the whole viewport when it's
    // the single pane showing; fixed 320px on desktop where it shares the
    // row with the thread + contact sidebar.
    <div className="flex h-full w-full flex-col border-r border-border bg-card lg:w-96">
      {/* Search + Filter */}
      <div className="space-y-2 border-b border-border p-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={handleSearchChange}
              placeholder={t("searchPlaceholder")}
              className="border-border bg-muted pl-9 text-foreground placeholder-muted-foreground focus:border-primary/50"
            />
          </div>
          {onNewMessage && (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-9 shrink-0"
              title={tNew("button")}
              aria-label={tNew("button")}
              onClick={onNewMessage}
            >
              <SquarePen className="size-4" />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium hover:bg-muted",
                assignmentFilter !== "all"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {assignmentFilter === "all"
                ? t("filterAssignment")
                : (activeAssignment?.label ?? t("filterAssignment"))}
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="border-border bg-popover"
            >
              {ASSIGNMENT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setAssignmentFilter(opt.value)}
                  className={cn(
                    assignmentFilter === opt.value
                      ? "font-medium text-primary"
                      : "font-normal text-popover-foreground",
                  )}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium hover:bg-muted",
                statusFilter !== "all"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {statusFilter === "all"
                ? t("filterStatus")
                : (activeStatus?.label ?? t("filterStatus"))}
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="border-border bg-popover"
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={cn(
                    statusFilter === opt.value
                      ? "font-medium text-primary"
                      : "font-normal text-popover-foreground",
                  )}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() => setUnreadOnly((v) => !v)}
            className={cn(
              "inline-flex h-7 items-center justify-center rounded-md px-2 text-xs font-medium",
              "transition-[color,background-color,transform] duration-150 ease-out active:scale-95",
              "motion-reduce:transition-none motion-reduce:active:scale-100",
              unreadOnly
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-pressed={unreadOnly}
          >
            {unreadOnly ? t("filterUnreadOn") : t("filterUnread")}
          </button>

          {tags.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium hover:bg-muted",
                  selectedTagIds.length > 0
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t("tags")}
                {selectedTagIds.length > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium tabular-nums text-primary-foreground">
                    {selectedTagIds.length}
                  </span>
                )}
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-64 w-56 border-border bg-popover"
              >
                {tags.map((tagRow) => (
                  <DropdownMenuCheckboxItem
                    key={tagRow.id}
                    checked={selectedTagIds.includes(tagRow.id)}
                    onCheckedChange={() => toggleTag(tagRow.id)}
                    className={cn(
                      "text-popover-foreground",
                      selectedTagIds.includes(tagRow.id)
                        ? "font-medium"
                        : "font-normal",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: tagRow.color }}
                      />
                      <span className="truncate">{tagRow.name}</span>
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {hasContactFilters && (
          <div className="flex flex-wrap items-center gap-1">
            {selectedTagIds.map((id) => {
              const tag = tagsById.get(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleTag(id)}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted/70"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag?.color ?? "var(--muted-foreground)" }}
                  />
                  <span className="max-w-24 truncate">{tag?.name ?? t("tags")}</span>
                  <X className="h-3 w-3" />
                </button>
              );
            })}
            <button
              onClick={clearContactFilters}
              className="px-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {t("clearAll")}
            </button>
          </div>
        )}
      </div>

      {/* Conversation Items.
          `min-h-0` is load-bearing: a flex child defaults to
          min-height:auto, so without it this ScrollArea grows to fit
          every conversation instead of shrinking to the remaining
          space — the list then overflows and gets clipped by the
          parent's overflow-hidden with no scrollbar (issue #229). */}
      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {hasListFilters
                ? t("noConversationsFiltered")
                : t("noConversations")}
            </p>
            {!hasListFilters && (
              <p className="max-w-[16rem] text-xs text-muted-foreground">
                {t("noConversationsHint")}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasListFilters && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={clearAllListFilters}
                >
                  {t("clearFilters")}
                </Button>
              )}
              {onNewMessage && (
                <Button type="button" size="sm" onClick={onNewMessage}>
                  {t("startMessage")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onSelect={handleSelect}
                assigneeName={
                  conv.assigned_agent_id
                    ? (profilesByUserId.get(conv.assigned_agent_id)
                        ?.full_name ?? null)
                    : null
                }
                t={t}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
  assigneeName: string | null;
  t: ReturnType<typeof useTranslations>;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  assigneeName,
  t,
}: ConversationItemProps) {
  const contact = conversation.contact;
  const displayName = contact?.name || contact?.phone || t("unknown");
  const initials = displayName.charAt(0).toUpperCase();
  const statusLabel = t(STATUS_LABEL_KEYS[conversation.status]);
  const assigneeLabel = conversation.assigned_agent_id
    ? (assigneeName ?? t("unknown"))
    : t("unassigned");

  const handleClick = useCallback(() => {
    onSelect(conversation);
  }, [onSelect, conversation]);

  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), {
        addSuffix: true,
        locale: ptBR,
      })
    : "";

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-3 px-3 py-3 text-left",
        "transition-[background-color,transform,border-color] duration-150 ease-out",
        "hover:bg-muted/50 active:scale-[0.995]",
        "motion-reduce:transition-none motion-reduce:active:scale-100",
        isActive && "border-l-2 border-primary bg-muted/70",
      )}
    >
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
        {contact?.avatar_url ? (
          <img
            src={contact.avatar_url}
            alt={displayName}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {displayName}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {timeAgo}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">
            {conversation.last_message_text || t("noMessagesYet")}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {conversation.unread_count > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium tabular-nums text-primary-foreground animate-in zoom-in-50 fade-in-0 duration-150 motion-reduce:animate-none">
                {conversation.unread_count}
              </span>
            )}
            <span
              className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 transition-colors duration-150"
              title={statusLabel}
              aria-label={statusLabel}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  STATUS_COLORS[conversation.status],
                )}
              />
              <span className="text-xs font-medium text-muted-foreground">
                {statusLabel}
              </span>
            </span>
          </div>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {assigneeLabel}
        </p>
      </div>
    </button>
  );
}
