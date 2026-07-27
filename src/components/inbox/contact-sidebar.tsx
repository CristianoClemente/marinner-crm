'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { Contact, Deal, ContactNote, Tag } from '@/types';
import {
  Phone,
  Mail,
  Copy,
  Check,
  Tag as TagIcon,
  DollarSign,
  StickyNote,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import { usePipelineLabels } from '@/hooks/use-pipeline-labels';

interface ContactSidebarProps {
  contact: Contact | null;
}

export function ContactSidebar({ contact }: ContactSidebarProps) {
  const tSidebar = useTranslations('Inbox.sidebar');
  const tThread = useTranslations('Inbox.messageThread');
  const { stageLabel } = usePipelineLabels();

  const { accountId } = useAuth();
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    const [dealsRes, notesRes, tagsRes] = await Promise.all([
      supabase
        .from('deals')
        .select('*, stage:pipeline_stages(*)')
        .eq('contact_id', contact.id)
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

    if (dealsRes.data) setDeals(dealsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        }));
      setTags(mapped);
    }
  }, [contact]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContactData();
  }, [fetchContactData]);

  const handleCopyPhone = useCallback(async () => {
    if (!contact?.phone) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [contact]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    if (!accountId) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from('contact_notes')
      .insert({
        contact_id: contact.id,
        account_id: accountId,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote('');
    }
    setAddingNote(false);
  }, [contact, newNote, accountId]);

  if (!contact) {
    return (
      <div className="flex h-full w-70 items-center justify-center border-l border-border bg-card">
        <p className="text-sm text-muted-foreground">
          {tThread('selectConversation')}
        </p>
      </div>
    );
  }

  const displayName = contact.name || contact.phone;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-full w-70 flex-col border-l border-border bg-card">
      <div className="shrink-0 border-b border-border px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-sm font-semibold text-foreground">
            {contact.avatar_url ? (
              <img
                src={contact.avatar_url}
                alt={displayName}
                className="size-11 object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {displayName}
            </h3>
            <div className="mt-2 space-y-1">
              <button
                type="button"
                onClick={handleCopyPhone}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Phone className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{contact.phone}</span>
                {copied ? (
                  <Check className="size-3.5 shrink-0 text-primary" />
                ) : (
                  <Copy className="size-3.5 shrink-0 opacity-60" />
                )}
              </button>
              {contact.email && (
                <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground">
                  <Mail className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{contact.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 px-4 py-4">
          <section>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <TagIcon className="size-3" />
              {tSidebar('tags')}
            </div>
            {tags.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {tSidebar('noTags')}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag.contact_tag_id}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${tag.color}20`,
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
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <DollarSign className="size-3" />
              {tSidebar('deals')}
            </div>
            {deals.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {tSidebar('noDeals')}
              </p>
            ) : (
              <div className="space-y-2">
                {deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-lg border border-border bg-muted/40 p-3"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {deal.title}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {deal.currency ?? '$'}
                        {deal.value.toLocaleString('pt-BR')}
                      </span>
                      {deal.stage && (
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: `${deal.stage.color}20`,
                            color: deal.stage.color,
                          }}
                        >
                          {stageLabel(deal.stage.name)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <StickyNote className="size-3" />
              {tSidebar('notes')}
            </div>
            <div className="mb-3 flex gap-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={tSidebar('addNotePlaceholder')}
                rows={2}
                className="min-w-0 flex-1 resize-none rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
              />
              <Button
                size="sm"
                className="h-auto shrink-0 bg-primary px-2 text-primary-foreground hover:bg-primary/90"
                onClick={handleAddNote}
                disabled={!newNote.trim() || addingNote}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>

            <div className="space-y-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg border border-border bg-muted/40 p-3"
                >
                  <p className="whitespace-pre-wrap text-xs text-foreground">
                    {note.note_text}
                  </p>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    {format(new Date(note.created_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
