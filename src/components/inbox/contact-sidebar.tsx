'use client';

import {
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { Contact, ContactNote, Tag } from '@/types';
import {
  Phone,
  Mail,
  Copy,
  Check,
  Tag as TagIcon,
  DollarSign,
  StickyNote,
  Plus,
  ExternalLink,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContactResidenciaButton } from '@/components/documents/contact-residencia-button';
import { ContactDetailView } from '@/components/contacts/contact-detail-view';
import { useTranslations } from 'next-intl';
import { usePipelineLabels } from '@/hooks/use-pipeline-labels';
import { DEFAULT_CURRENCY, formatCurrency } from '@/lib/currency';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ContactSidebarProps {
  contact: Contact | null;
  /**
   * Quando true (ex.: Sheet no mobile), ocupa a largura do container
   * sem borda lateral — o painel fixo de desktop mantém largura + border-l.
   */
  embedded?: boolean;
}

type SidebarDeal = {
  id: string;
  title: string | null;
  value: number;
  currency: string | null;
  stage: { name: string; color: string | null } | null;
};

function SectionLabel({
  icon: Icon,
  label,
  action,
}: {
  icon: typeof TagIcon;
  label: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      {action}
    </div>
  );
}

export function ContactSidebar({
  contact,
  embedded = false,
}: ContactSidebarProps) {
  const tSidebar = useTranslations('Inbox.sidebar');
  const { stageLabel } = usePipelineLabels();
  const { accountId } = useAuth();

  const [copied, setCopied] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deals, setDeals] = useState<SidebarDeal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;
    setLoading(true);

    const supabase = createClient();
    const [dealsRes, notesRes, tagsRes] = await Promise.all([
      supabase
        .from('enrollment_processes')
        .select(
          'id, title, value, currency, current_stage:process_template_stages!enrollment_processes_current_stage_id_fkey(name, color)',
        )
        .eq('contact_id', contact.id)
        .not('commercial_status', 'is', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('contact_notes')
        .select('*')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('contact_tags')
        .select('id, tag_id, tags(*)')
        .eq('contact_id', contact.id),
    ]);

    if (dealsRes.data) {
      setDeals(
        dealsRes.data.map((row) => {
          const stage = Array.isArray(row.current_stage)
            ? row.current_stage[0]
            : row.current_stage;
          return {
            id: row.id as string,
            title: (row.title as string | null) ?? null,
            value: Number(row.value ?? 0),
            currency: (row.currency as string | null) ?? null,
            stage: stage
              ? {
                  name: stage.name as string,
                  color: (stage.color as string | null) ?? null,
                }
              : null,
          };
        }),
      );
    } else {
      setDeals([]);
    }

    setNotes((notesRes.data as ContactNote[]) ?? []);

    if (tagsRes.data) {
      setTags(
        tagsRes.data
          .filter((ct: Record<string, unknown>) => ct.tags)
          .map((ct: Record<string, unknown>) => ({
            ...(ct.tags as Tag),
            contact_tag_id: ct.id as string,
          })),
      );
    } else {
      setTags([]);
    }

    setLoading(false);
  }, [contact]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchContactData();
  }, [fetchContactData]);

  const handleCopyPhone = useCallback(async () => {
    if (!contact?.phone) return;
    try {
      await navigator.clipboard.writeText(contact.phone);
      setCopied(true);
      toast.success(tSidebar('phoneCopied'));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard pode falhar em contextos restritos — o botão ainda tenta.
    }
  }, [contact, tSidebar]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim() || !accountId) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { data, error } = await supabase
      .from('contact_notes')
      .insert({
        contact_id: contact.id,
        account_id: accountId,
        user_id: session?.user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (error || !data) {
      toast.error(tSidebar('noteSaveError'));
      setAddingNote(false);
      return;
    }

    setNotes((prev) => [data as ContactNote, ...prev]);
    setNewNote('');
    toast.success(tSidebar('noteSaved'));
    setAddingNote(false);
  }, [contact, newNote, accountId, tSidebar]);

  const handleDetailUpdated = useCallback(() => {
    void fetchContactData();
  }, [fetchContactData]);

  const shellClass = cn(
    'flex h-full flex-col bg-card',
    embedded ? 'w-full' : 'w-72 border-l border-border',
  );

  if (!contact) {
    return (
      <div className={cn(shellClass, 'items-center justify-center px-6')}>
        <p className="text-center text-sm text-muted-foreground">
          {tSidebar('emptySelect')}
        </p>
      </div>
    );
  }

  const displayName = contact.name || contact.phone;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className={shellClass}>
      {/* Identidade — âncora do painel */}
      <header className="shrink-0 space-y-3 border-b border-border px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-foreground ring-1 ring-foreground/10">
            {contact.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={contact.avatar_url}
                alt={displayName}
                className="size-12 object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="truncate text-base font-medium leading-snug tracking-tight text-foreground">
              {displayName}
            </h3>
            {contact.name && contact.phone ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {contact.phone}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-0.5">
          {contact.phone ? (
            <button
              type="button"
              onClick={handleCopyPhone}
              aria-label={tSidebar('copyPhone')}
              className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Phone className="size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{contact.phone}</span>
              {copied ? (
                <Check className="size-3.5 shrink-0 text-primary" aria-hidden />
              ) : (
                <Copy
                  className="size-3.5 shrink-0 opacity-50"
                  aria-hidden
                />
              )}
            </button>
          ) : null}
          {contact.email ? (
            <div className="flex h-9 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground">
              <Mail className="size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{contact.email}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={() => setDetailOpen(true)}
          >
            <ExternalLink className="size-3.5" aria-hidden />
            {tSidebar('manageContact')}
          </Button>
          {contact.id ? (
            <ContactResidenciaButton contactId={contact.id} />
          ) : null}
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <section>
                <SectionLabel
                  icon={TagIcon}
                  label={tSidebar('tags')}
                  action={
                    <button
                      type="button"
                      onClick={() => setDetailOpen(true)}
                      className="shrink-0 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                    >
                      {tSidebar('manageTagsHint')}
                    </button>
                  }
                />
                {tags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {tSidebar('noTags')}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag.contact_tag_id}
                        className="rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-foreground/10"
                        style={{
                          backgroundColor: `${tag.color}18`,
                          color: tag.color,
                        }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <SectionLabel icon={DollarSign} label={tSidebar('deals')} />
                {deals.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {tSidebar('noDeals')}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {deals.map((deal) => (
                      <li key={deal.id}>
                        <button
                          type="button"
                          onClick={() => setDetailOpen(true)}
                          title={tSidebar('openDeal')}
                          className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {deal.title || '—'}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                              <span>
                                {formatCurrency(
                                  deal.value,
                                  deal.currency || DEFAULT_CURRENCY,
                                )}
                              </span>
                              {deal.stage ? (
                                <span
                                  className="rounded-md bg-muted px-1.5 py-px font-medium text-muted-foreground"
                                  style={
                                    deal.stage.color
                                      ? {
                                          backgroundColor: `${deal.stage.color}18`,
                                          color: deal.stage.color,
                                        }
                                      : undefined
                                  }
                                >
                                  {stageLabel(deal.stage.name)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <ChevronRight
                            className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                            aria-hidden
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <SectionLabel icon={StickyNote} label={tSidebar('notes')} />
                <div className="mb-3 flex gap-2">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder={tSidebar('addNotePlaceholder')}
                    rows={2}
                    className="min-h-11 min-w-0 flex-1 resize-none rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-auto shrink-0 self-stretch px-2.5"
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || addingNote}
                    aria-label={tSidebar('addNote')}
                  >
                    {addingNote ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                  </Button>
                </div>

                {notes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {tSidebar('noNotes')}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {notes.map((note) => (
                      <li
                        key={note.id}
                        className="rounded-lg bg-muted/50 px-3 py-2.5 ring-1 ring-foreground/5"
                      >
                        <p className="whitespace-pre-wrap text-sm leading-snug text-foreground">
                          {note.note_text}
                        </p>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {formatDateTime(note.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </ScrollArea>

      <ContactDetailView
        open={detailOpen}
        onOpenChange={setDetailOpen}
        contactId={contact.id}
        onUpdated={handleDetailUpdated}
      />
    </div>
  );
}
