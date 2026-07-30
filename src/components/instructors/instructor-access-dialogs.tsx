"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { AccountMember, Instructor } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InviteResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  instructorName: string;
}

export function InviteResultDialog({
  open,
  onOpenChange,
  url,
  instructorName,
}: InviteResultDialogProps) {
  const t = useTranslations("Instructors");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("inviteResultTitle")}</DialogTitle>
          <DialogDescription>
            {t("inviteResultDesc", { name: instructorName })}
          </DialogDescription>
        </DialogHeader>
        {url && (
          <div className="flex items-center gap-2">
            <Input readOnly value={url} className="text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("form.copyInvite")}
              onClick={() => {
                void navigator.clipboard.writeText(url);
                toast.success(t("form.inviteCopied"));
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t("inviteLinkOnce")}</p>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("inviteResultDone")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface LinkMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instructor: Instructor | null;
  onLinked: () => void;
}

export function LinkMemberDialog({
  open,
  onOpenChange,
  instructor,
  onLinked,
}: LinkMemberDialogProps) {
  const t = useTranslations("Instructors");
  const tForm = useTranslations("Instructors.form");
  const [members, setMembers] = useState<AccountMember[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!open || !instructor) return;
    setUserId("");
    setLoading(true);
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/account/members");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || tForm("extrasLoadError"));
        if (!cancelled) setMembers(data.members ?? []);
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : tForm("extrasLoadError"),
          );
          setMembers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, instructor, tForm]);

  const linkable = members.filter(
    (m) => m.role === "instructor" && m.user_id !== instructor?.user_id,
  );

  async function handleLink() {
    if (!instructor || !userId) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/instructors/${instructor.id}/link-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tForm("linkError"));
      toast.success(tForm("linked"));
      onLinked();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tForm("linkError"));
    } finally {
      setLinking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("linkMemberTitle")}</DialogTitle>
          <DialogDescription>
            {t("linkMemberDesc", {
              name: instructor?.full_name ?? "",
            })}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>{tForm("linkUser")}</Label>
            <Select
              value={userId || undefined}
              onValueChange={(v) => v && setUserId(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={tForm("linkUserPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {linkable.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name || m.email || m.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {linkable.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground">
                {tForm("noInstructorMembers")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{tForm("linkHint")}</p>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tForm("cancel")}
          </Button>
          <Button
            type="button"
            disabled={!userId || linking || loading}
            onClick={() => void handleLink()}
          >
            {linking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            {tForm("link")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Dispara POST invite; retorna a URL ou lança. */
export async function createInstructorInvite(
  instructorId: string,
): Promise<string> {
  const res = await fetch(`/api/instructors/${instructorId}/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Falha ao criar convite",
    );
  }
  return data.url as string;
}
