import { describe, expect, it } from "vitest";
import {
  INSTRUCTOR_HOME,
  isInstructorAllowedPath,
} from "./instructor-routes";
import { hasMinRole } from "./roles";

describe("isInstructorAllowedPath", () => {
  it("permite disponibilidade e settings", () => {
    expect(isInstructorAllowedPath("/my-availability")).toBe(true);
    expect(isInstructorAllowedPath("/settings")).toBe(true);
    expect(isInstructorAllowedPath("/settings/profile")).toBe(true);
  });

  it("bloqueia rotas operacionais do CRM", () => {
    expect(isInstructorAllowedPath("/inbox")).toBe(false);
    expect(isInstructorAllowedPath("/pos")).toBe(false);
    expect(isInstructorAllowedPath("/catalog")).toBe(false);
    expect(isInstructorAllowedPath("/dashboard")).toBe(false);
    expect(isInstructorAllowedPath("/instructors")).toBe(false);
  });
});

describe("instructor vs agent+ gates", () => {
  it("não satisfaz requireRole agent/viewer", () => {
    expect(hasMinRole("instructor", "viewer")).toBe(false);
    expect(hasMinRole("instructor", "agent")).toBe(false);
    expect(hasMinRole("instructor", "admin")).toBe(false);
  });

  it("home padrão é my-availability", () => {
    expect(INSTRUCTOR_HOME).toBe("/my-availability");
  });
});
