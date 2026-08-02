import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Bot,
  CalendarDays,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  ListTodo,
  MapPin,
  MessageSquare,
  Package,
  Radio,
  School,
  Settings2,
  Ship,
  ShoppingCart,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

import type { AccountRole } from "@/lib/auth/roles";
import { hasMinRole, isInstructorRole } from "@/lib/auth/roles";

export type NavLabelKey =
  | "dashboard"
  | "inbox"
  | "notifications"
  | "contacts"
  | "pipelines"
  | "processes"
  | "pos"
  | "school"
  | "automation"
  | "catalog"
  | "classLocations"
  | "equipment"
  | "instructors"
  | "agenda"
  | "processTemplates"
  | "broadcasts"
  | "automations"
  | "flows"
  | "aiAgents"
  | "myAvailability"
  | "settings";

export interface NavItemDef {
  href: string;
  labelKey: NavLabelKey;
  icon: LucideIcon;
  minRole: AccountRole;
  beta?: boolean;
}

/** Grupo recolhível da sidebar — o próprio grupo não é uma rota. */
export interface NavGroupDef {
  id: "school" | "automation";
  labelKey: NavLabelKey;
  icon: LucideIcon;
  /** Role mínima para o grupo aparecer (filhos filtram novamente). */
  minRole: AccountRole;
  children: readonly NavItemDef[];
}

export const PRIMARY_NAV: readonly NavItemDef[] = [
  {
    href: "/dashboard",
    labelKey: "dashboard",
    icon: LayoutDashboard,
    minRole: "viewer",
  },
  { href: "/inbox", labelKey: "inbox", icon: MessageSquare, minRole: "viewer" },
  {
    href: "/notifications",
    labelKey: "notifications",
    icon: Bell,
    minRole: "viewer",
  },
  { href: "/contacts", labelKey: "contacts", icon: Users, minRole: "viewer" },
  {
    href: "/pipelines",
    labelKey: "pipelines",
    icon: GitBranch,
    minRole: "viewer",
  },
  {
    href: "/processes",
    labelKey: "processes",
    icon: ListTodo,
    minRole: "viewer",
  },
  { href: "/pos", labelKey: "pos", icon: ShoppingCart, minRole: "viewer" },
  {
    href: "/agenda",
    labelKey: "agenda",
    icon: CalendarDays,
    minRole: "viewer",
  },
] as const;

export const NAV_GROUPS: readonly NavGroupDef[] = [
  {
    id: "school",
    labelKey: "school",
    icon: School,
    minRole: "viewer",
    children: [
      {
        href: "/catalog",
        labelKey: "catalog",
        icon: Package,
        minRole: "viewer",
      },
      {
        href: "/class-locations",
        labelKey: "classLocations",
        icon: MapPin,
        minRole: "admin",
      },
      {
        href: "/equipment",
        labelKey: "equipment",
        icon: Ship,
        minRole: "admin",
      },
      {
        href: "/instructors",
        labelKey: "instructors",
        icon: GraduationCap,
        minRole: "admin",
      },
      {
        href: "/process-templates",
        labelKey: "processTemplates",
        icon: Settings2,
        minRole: "admin",
      },
    ],
  },
  {
    id: "automation",
    labelKey: "automation",
    icon: Sparkles,
    minRole: "admin",
    children: [
      {
        href: "/broadcasts",
        labelKey: "broadcasts",
        icon: Radio,
        minRole: "admin",
      },
      {
        href: "/automations",
        labelKey: "automations",
        icon: Zap,
        minRole: "admin",
      },
      {
        href: "/flows",
        labelKey: "flows",
        icon: Workflow,
        minRole: "admin",
        beta: true,
      },
      { href: "/agents", labelKey: "aiAgents", icon: Bot, minRole: "admin" },
    ],
  },
] as const;

export const INSTRUCTOR_NAV: readonly NavItemDef[] = [
  {
    href: "/my-availability",
    labelKey: "myAvailability",
    icon: CalendarDays,
    minRole: "instructor",
  },
] as const;

export function canSeeNavItem(
  role: AccountRole | null | undefined,
  item: { minRole: AccountRole; href?: string },
): boolean {
  if (!role) return false;
  if (isInstructorRole(role)) {
    return item.minRole === "instructor";
  }
  return hasMinRole(role, item.minRole);
}

export function filterNavItems(
  items: readonly NavItemDef[],
  role: AccountRole | null | undefined,
): NavItemDef[] {
  return items.filter((item) => canSeeNavItem(role, item));
}

/** Grupos visíveis já com os filhos filtrados; grupo sem filho é omitido. */
export function filterNavGroups(
  role: AccountRole | null | undefined,
): { group: NavGroupDef; children: NavItemDef[] }[] {
  return NAV_GROUPS.filter((group) => canSeeNavItem(role, group))
    .map((group) => ({
      group,
      children: filterNavItems(group.children, role),
    }))
    .filter((entry) => entry.children.length > 0);
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isGroupActive(
  pathname: string,
  children: readonly NavItemDef[],
): boolean {
  return children.some((child) => isNavItemActive(pathname, child.href));
}

/** Títulos do header por rota (chave em messages Header.*). */
export const HEADER_TITLE_BY_PATH: Record<string, NavLabelKey> = {
  "/dashboard": "dashboard",
  "/inbox": "inbox",
  "/notifications": "notifications",
  "/contacts": "contacts",
  "/pipelines": "pipelines",
  "/processes": "processes",
  "/process-templates": "processTemplates",
  "/catalog": "catalog",
  "/agenda": "agenda",
  "/class-locations": "classLocations",
  "/equipment": "equipment",
  "/instructors": "instructors",
  "/my-availability": "myAvailability",
  "/pos": "pos",
  "/broadcasts": "broadcasts",
  "/automations": "automations",
  "/flows": "flows",
  "/agents": "aiAgents",
  "/settings": "settings",
};
