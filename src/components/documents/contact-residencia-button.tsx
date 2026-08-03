"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileText } from "lucide-react";

import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import {
  downloadGeneratedDocument,
  GenerateDocumentDialog,
  postGenerateDocument,
} from "@/components/documents/generate-document-dialog";

export function ContactResidenciaButton({
  contactId,
}: {
  contactId: string;
}) {
  const t = useTranslations("Documents");
  const canManage = useCan("edit-settings");
  const [open, setOpen] = useState(false);

  if (!canManage) return null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <FileText className="size-4" />
        {t("residencia")}
      </Button>
      <GenerateDocumentDialog
        open={open}
        onOpenChange={setOpen}
        title={t("residencia")}
        onGenerate={async () => {
          const doc = await postGenerateDocument({
            kind: "declaracao_residencia",
            contactId,
          });
          toast.success(t("generateSuccess"));
          await downloadGeneratedDocument(doc.id);
        }}
      />
    </>
  );
}
