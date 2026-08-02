"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MessageCircleOff } from "lucide-react";
import { toast } from "sonner";

import { useWhatsAppHealth } from "@/hooks/use-whatsapp-health";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TOAST_SESSION_KEY = "marinner:whatsapp-offline-toast";
const SETTINGS_WHATSAPP_HREF = "/settings?tab=whatsapp";

function toastCopyKey(
  reason: string,
): "toastNoConfig" | "toastToken" | "toastDisconnected" {
  if (reason === "no_config" || reason === "no_account") return "toastNoConfig";
  if (reason === "token_corrupted") return "toastToken";
  return "toastDisconnected";
}

/**
 * Ícone no header + toast 1×/sessão quando o WhatsApp da conta está fora.
 */
export function WhatsAppOfflineIndicator() {
  const t = useTranslations("Header.whatsappHealth");
  const pathname = usePathname();
  const router = useRouter();
  const { online, reason, loading } = useWhatsAppHealth();
  const toastedRef = useRef(false);
  const onSettings = pathname.startsWith("/settings");

  useEffect(() => {
    if (!loading && online) {
      try {
        sessionStorage.removeItem(TOAST_SESSION_KEY);
      } catch {
        // ignore
      }
      toastedRef.current = false;
    }
  }, [loading, online]);

  useEffect(() => {
    if (loading || online || toastedRef.current || onSettings) return;

    try {
      if (sessionStorage.getItem(TOAST_SESSION_KEY) === "1") return;
      sessionStorage.setItem(TOAST_SESSION_KEY, "1");
    } catch {
      // sessionStorage indisponível — ainda assim limita via ref
    }

    toastedRef.current = true;
    toast.warning(t(toastCopyKey(reason)), {
      description: t("toastHint"),
      action: {
        label: t("toastAction"),
        onClick: () => router.push(SETTINGS_WHATSAPP_HREF),
      },
      duration: 8_000,
    });
  }, [loading, online, onSettings, reason, router, t]);

  if (loading || online) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={SETTINGS_WHATSAPP_HREF}
              aria-label={t("ariaOffline")}
              className="relative flex h-9 w-9 items-center justify-center rounded-md text-amber-600 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
            />
          }
        >
          <MessageCircleOff className="size-4" />
          <span
            aria-hidden
            className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-amber-500"
          />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px] text-left">
          <p className="font-medium">{t(toastCopyKey(reason))}</p>
          <p className="text-xs opacity-90">{t("tooltipHint")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
