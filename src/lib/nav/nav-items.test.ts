import { describe, expect, it } from "vitest";
import {
  filterNavGroups,
  filterNavItems,
  isGroupActive,
  isNavItemActive,
  NAV_GROUPS,
  PRIMARY_NAV,
} from "./nav-items";

const schoolChildren = NAV_GROUPS.find((g) => g.id === "school")!.children;

describe("filterNavItems", () => {
  it("agent vê a nav operacional (inclui PDV e Agenda), sem Funis", () => {
    const hrefs = filterNavItems(PRIMARY_NAV, "agent").map((i) => i.href);
    expect(hrefs).toContain("/processes");
    expect(hrefs).toContain("/pos");
    expect(hrefs).toContain("/agenda");
    expect(hrefs).not.toContain("/process-templates");
  });

  it("admin vê Funis logo após Kanban", () => {
    const hrefs = filterNavItems(PRIMARY_NAV, "admin").map((i) => i.href);
    const processesIdx = hrefs.indexOf("/processes");
    const templatesIdx = hrefs.indexOf("/process-templates");
    expect(processesIdx).toBeGreaterThanOrEqual(0);
    expect(templatesIdx).toBe(processesIdx + 1);
  });

  it("instructor não vê nav do CRM", () => {
    expect(filterNavItems(PRIMARY_NAV, "instructor")).toEqual([]);
  });

  it("sem role não vê nada", () => {
    expect(filterNavItems(PRIMARY_NAV, null)).toEqual([]);
  });
});

describe("filterNavGroups", () => {
  it("admin vê os dois grupos completos", () => {
    const groups = filterNavGroups("admin");
    expect(groups.map((g) => g.group.id)).toEqual(["school", "automation"]);
    expect(groups[1].children).toHaveLength(4);
  });

  it("agent vê só Escola, com catálogo como único filho", () => {
    const groups = filterNavGroups("agent");
    expect(groups.map((g) => g.group.id)).toEqual(["school"]);
    expect(groups[0].children.map((c) => c.href)).toEqual(["/catalog"]);
  });

  it("viewer também fica só com catálogo", () => {
    const groups = filterNavGroups("viewer");
    expect(groups.map((g) => g.group.id)).toEqual(["school"]);
    expect(groups[0].children.map((c) => c.href)).toEqual(["/catalog"]);
  });

  it("instructor não vê grupos", () => {
    expect(filterNavGroups("instructor")).toEqual([]);
  });
});

describe("isNavItemActive / isGroupActive", () => {
  it("processos não ativa em templates de processo", () => {
    expect(isNavItemActive("/processes", "/processes")).toBe(true);
    expect(isNavItemActive("/process-templates", "/processes")).toBe(false);
  });

  it("rota filha ativa o grupo", () => {
    expect(isGroupActive("/catalog/123", schoolChildren)).toBe(true);
    expect(isGroupActive("/inbox", schoolChildren)).toBe(false);
  });

  it("Funis não fica no grupo Escola", () => {
    expect(schoolChildren.map((c) => c.href)).not.toContain(
      "/process-templates",
    );
  });
});
