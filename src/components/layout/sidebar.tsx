"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import {
  Bell,
  Bot,
  Crown,
  GitBranch,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Radio,
  Settings,
  Shield,
  User,
  UserCog,
  Users,
  UsersRound,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import type { AccountRole } from "@/lib/auth/roles";
import { DEFAULT_LOGO_SRC } from "@/lib/brand";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslations } from "next-intl";
import { useWhatsAppProvider } from "@/hooks/use-whatsapp-provider";

const SIDEBAR_COLLAPSED_KEY = "marinner:sidebar:collapsed";

const ROLE_CHIP: Record<
  AccountRole,
  { icon: typeof Crown; labelKey: string; className: string }
> = {
  owner: {
    icon: Crown,
    labelKey: "roleOwner",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  admin: {
    icon: Shield,
    labelKey: "roleAdmin",
    className: "border-primary/40 bg-primary/10 text-primary",
  },
  agent: {
    icon: UserCog,
    labelKey: "roleAgent",
    className: "border-border bg-muted text-foreground",
  },
  viewer: {
    icon: User,
    labelKey: "roleViewer",
    className: "border-border bg-card text-muted-foreground",
  },
};

interface NavItem {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  beta?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/inbox", labelKey: "inbox", icon: MessageSquare },
  { href: "/notifications", labelKey: "notifications", icon: Bell },
  { href: "/contacts", labelKey: "contacts", icon: Users },
  { href: "/pipelines", labelKey: "pipelines", icon: GitBranch },
  { href: "/broadcasts", labelKey: "broadcasts", icon: Radio },
  { href: "/automations", labelKey: "automations", icon: Zap },
  { href: "/flows", labelKey: "flows", icon: Workflow, beta: true },
  { href: "/agents", labelKey: "aiAgents", icon: Bot },
];

const bottomNavItems = [
  { href: "/settings", labelKey: "settings", icon: Settings },
];

interface SidebarProps {
  /** Controlled on mobile by the Header's hamburger button. Ignored on lg+. */
  open?: boolean;
  onClose?: () => void;
}

function SidebarTooltip({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="block w-full" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();
  const { profile, profileLoading, account, accountRole, signOut } = useAuth();
  const { isZapi } = useWhatsAppProvider();
  const totalUnread = useTotalUnread();
  const unreadNotifications = useUnreadNotifications();
  const [collapsed, setCollapsed] = useState(false);
  const [collapseReady, setCollapseReady] = useState(false);

  const showAccountStrip =
    !profileLoading &&
    !!account?.name &&
    account.name !== profile?.full_name;

  // Preferência só no desktop; lida após mount para evitar mismatch de SSR.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    } catch {
      // private browsing / sandbox
    }
    setCollapseReady(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // No mobile o drawer sempre mostra labels; collapse só vale em lg+.
  const rail = collapseReady && collapsed;

  return (
    <TooltipProvider delay={300}>
      <button
        type="button"
        aria-label={t("closeMenu")}
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-background/70 backdrop-blur-sm transition-opacity lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-border bg-card",
          "transition-transform duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-0 lg:translate-x-0 lg:transition-[width] lg:duration-200 lg:ease-out",
          rail ? "lg:w-16" : "lg:w-60",
        )}
        aria-label="Primary"
        data-collapsed={rail ? "true" : "false"}
      >
        <div
          className={cn(
            "flex shrink-0 items-center border-b border-border",
            rail
              ? "flex-col gap-1 px-2 py-2"
              : "h-14 justify-between gap-2 px-4",
          )}
        >
          <Link
            href="/dashboard"
            className={cn(
              "flex min-w-0 items-center gap-2",
              rail && "justify-center",
            )}
            title={account?.name || t("title")}
          >
            {account?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={account.logo_url}
                alt=""
                className="h-8 w-8 shrink-0 rounded-lg bg-muted object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={DEFAULT_LOGO_SRC}
                alt=""
                className="h-8 w-8 shrink-0 rounded-lg object-contain"
              />
            )}
            <span
              className={cn(
                "truncate text-sm font-semibold text-foreground",
                rail && "lg:hidden",
              )}
            >
              {account?.name || t("title")}
            </span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeMenu")}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={rail ? t("expand") : t("collapse")}
            aria-expanded={!rail}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:flex"
          >
            {rail ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4 lg:px-3">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const label = t(item.labelKey as string);
              const showUnreadDot =
                item.href === "/inbox" && totalUnread > 0 && !isActive;
              const showNotificationBadge =
                item.href === "/notifications" && unreadNotifications > 0;
              const showBroadcastsMetaOnly =
                item.href === "/broadcasts" && isZapi;
              const tooltipLabel = showBroadcastsMetaOnly
                ? `${label} — ${t("broadcastsMetaOnlyHint")}`
                : label;

              return (
                <li key={item.href}>
                  <SidebarTooltip label={tooltipLabel} enabled={rail}>
                    <Link
                      href={item.href}
                      title={
                        rail
                          ? tooltipLabel
                          : showBroadcastsMetaOnly
                            ? t("broadcastsMetaOnlyHint")
                            : undefined
                      }
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2",
                        rail && "lg:justify-center lg:px-0",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span
                        className={cn(
                          "flex-1 truncate",
                          rail && "lg:hidden",
                        )}
                      >
                        {label}
                      </span>
                      {item.beta && (
                        <span
                          aria-label={t("beta")}
                          className={cn(
                            "rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300",
                            rail && "lg:hidden",
                          )}
                        >
                          {t("beta")}
                        </span>
                      )}
                      {showBroadcastsMetaOnly && (
                        <span
                          aria-label={t("broadcastsMetaOnlyHint")}
                          className={cn(
                            "shrink-0 text-[10px] font-medium tracking-wide text-muted-foreground/70",
                            rail &&
                              "lg:absolute lg:right-1 lg:bottom-1 lg:text-[8px]",
                          )}
                        >
                          {t("broadcastsMetaOnly")}
                        </span>
                      )}
                      {showUnreadDot && (
                        <span
                          aria-label={t("unreadConversations", {
                            count: totalUnread,
                          })}
                          className={cn(
                            "relative flex h-2 w-2",
                            rail && "lg:absolute lg:right-2 lg:top-2",
                          )}
                        >
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                        </span>
                      )}
                      {showNotificationBadge && (
                        <span
                          aria-label={t("unreadNotifications", {
                            count: unreadNotifications,
                          })}
                          className={cn(
                            "flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground",
                            rail &&
                              "lg:absolute lg:right-1 lg:top-1 lg:h-4 lg:min-w-4 lg:px-0.5 lg:text-[9px]",
                          )}
                        >
                          {unreadNotifications > 9
                            ? "9+"
                            : unreadNotifications}
                        </span>
                      )}
                    </Link>
                  </SidebarTooltip>
                </li>
              );
            })}
          </ul>

          <div className="my-4 border-t border-border" />

          <ul className="flex flex-col gap-1">
            {bottomNavItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const label = t(item.labelKey as string);
              return (
                <li key={item.href}>
                  <SidebarTooltip label={label} enabled={rail}>
                    <Link
                      href={item.href}
                      title={rail ? label : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2",
                        rail && "lg:justify-center lg:px-0",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className={cn(rail && "lg:hidden")}>{label}</span>
                    </Link>
                  </SidebarTooltip>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={cn("shrink-0 border-t border-border p-2 lg:p-3")}>
          {showAccountStrip && account?.name ? (
            <div
              className={cn(
                "mb-2 flex items-center gap-2 px-3 text-xs text-muted-foreground",
                rail && "lg:justify-center lg:px-0",
              )}
              title={account.name}
            >
              <UsersRound className="size-3.5 shrink-0" />
              <span className={cn("truncate", rail && "lg:hidden")}>
                {account.name}
              </span>
              {accountRole && !rail ? (
                (() => {
                  const meta = ROLE_CHIP[accountRole];
                  const Icon = meta.icon;
                  return (
                    <span
                      className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.className}`}
                    >
                      <Icon className="size-3" />
                      {t(meta.labelKey as string)}
                    </span>
                  );
                })()
              ) : null}
            </div>
          ) : null}

          <DropdownMenu>
            <SidebarTooltip
              label={profile?.full_name ?? t("defaultUser")}
              enabled={rail}
            >
              <DropdownMenuTrigger
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/60 focus:bg-muted/60 focus:outline-none data-popup-open:bg-muted/60",
                  rail && "lg:justify-center lg:px-0",
                )}
              >
                <Avatar className="size-8 shrink-0">
                  {profile?.avatar_url ? (
                    <AvatarImage
                      src={profile.avatar_url}
                      alt={profile.full_name ?? t("defaultAvatar")}
                    />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                    {profile?.full_name?.charAt(0)?.toUpperCase() ??
                      profile?.email?.charAt(0)?.toUpperCase() ??
                      "U"}
                  </AvatarFallback>
                </Avatar>
                <div className={cn("min-w-0 flex-1", rail && "lg:hidden")}>
                  <p className="truncate text-sm font-medium text-foreground">
                    {profile?.full_name ?? t("defaultUser")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {profile?.email ?? ""}
                  </p>
                </div>
              </DropdownMenuTrigger>
            </SidebarTooltip>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={6}
              className="min-w-56 bg-popover text-popover-foreground ring-border"
            >
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=profile"
                    onClick={onClose}
                    className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                  />
                }
              >
                <User className="size-4" />
                {t("menuProfile")}
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=whatsapp"
                    onClick={onClose}
                    className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                  />
                }
              >
                <Settings className="size-4" />
                {t("menuSettings")}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={signOut}
                className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
              >
                <LogOut className="size-4" />
                {t("menuSignOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipProvider>
  );
}
