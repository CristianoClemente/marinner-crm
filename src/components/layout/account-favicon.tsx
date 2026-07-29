"use client";

import { useEffect } from "react";

import { useAuth } from "@/hooks/use-auth";
import { DEFAULT_FAVICON_SRC } from "@/lib/brand";

const LINK_ATTR = "data-account-favicon";

/**
 * Favicon da escola na sessão autenticada (Fatia 1).
 *
 * Sem Host→tenant ainda, o favicon padrão (login/apex) é
 * `DEFAULT_FAVICON_SRC` (Marinner). No dashboard, se a conta tem
 * `logo_url`, trocamos o `<link rel="icon">` no cliente. Na Fatia 2
 * o favicon poderá vir do servidor pelo subdomínio.
 */
export function AccountFavicon() {
  const { account } = useAuth();
  const logoUrl = account?.logo_url ?? null;

  useEffect(() => {
    const href = logoUrl || DEFAULT_FAVICON_SRC;

    let link = document.querySelector<HTMLLinkElement>(
      `link[rel="icon"][${LINK_ATTR}]`,
    );
    if (!link) {
      const existing = document.querySelector<HTMLLinkElement>(
        'link[rel="icon"]',
      );
      if (existing) {
        link = existing;
        link.setAttribute(LINK_ATTR, "1");
      } else {
        link = document.createElement("link");
        link.rel = "icon";
        link.setAttribute(LINK_ATTR, "1");
        document.head.appendChild(link);
      }
    }

    if (logoUrl) {
      link.removeAttribute("type");
    } else {
      link.type = "image/svg+xml";
    }
    link.href = href;

    return () => {
      if (link) {
        link.type = "image/svg+xml";
        link.href = DEFAULT_FAVICON_SRC;
      }
    };
  }, [logoUrl]);

  return null;
}
