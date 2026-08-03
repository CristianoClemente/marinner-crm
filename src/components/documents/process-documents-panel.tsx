"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import {
  downloadGeneratedDocument,
  GenerateDocumentDialog,
  postGenerateDocument,
} from "@/components/documents/generate-document-dialog";

type DocRow = {
  id: string;
  kind: string;
  file_name: string;
  created_at: string;
};

type Props = {
  processId: string;
  contactId: string | null | undefined;
};

export function ProcessDocumentsPanel({ processId, contactId }: Props) {
  const t = useTranslations("Documents");
  const canManage = useCan("edit-settings");
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [residenciaOpen, setResidenciaOpen] = useState(false);
  const [requerimentoOpen, setRequerimentoOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents?processId=${processId}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t("loadFailed"));
      setDocs(json.documents ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [processId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canManage) return null;

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">
          {t("sectionTitle")}
        </h3>
        {loading ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!contactId}
          onClick={() => setResidenciaOpen(true)}
        >
          <FileText className="size-3.5" />
          {t("residencia")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setRequerimentoOpen(true)}
        >
          <FileText className="size-3.5" />
          {t("requerimento")}
        </Button>
      </div>
      {docs.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("emptyList")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{d.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {d.kind} · {formatDateTime(d.created_at)}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void downloadGeneratedDocument(d.id)}
              >
                {t("download")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <GenerateDocumentDialog
        open={residenciaOpen}
        onOpenChange={setResidenciaOpen}
        title={t("residencia")}
        onGenerate={async () => {
          if (!contactId) return;
          const doc = await postGenerateDocument({
            kind: "declaracao_residencia",
            contactId,
            processId,
          });
          toast.success(t("generateSuccess"));
          await downloadGeneratedDocument(doc.id);
          await load();
        }}
      />

      <GenerateDocumentDialog
        open={requerimentoOpen}
        onOpenChange={setRequerimentoOpen}
        title={t("requerimento")}
        mode="requerimento"
        onGenerate={async (extra) => {
          const doc = await postGenerateDocument({
            kind: "requerimento_capitania",
            processId,
            serviceOption: extra.serviceOption,
            serviceDescription: extra.serviceDescription,
          });
          toast.success(t("generateSuccess"));
          await downloadGeneratedDocument(doc.id);
          await load();
        }}
      />
    </section>
  );
}
