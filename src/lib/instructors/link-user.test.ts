import { describe, expect, it } from "vitest";
import { evaluateLinkUser, isUuid } from "./link-user";

describe("evaluateLinkUser", () => {
  const base = {
    accountId: "acct-1",
    instructorUserId: null as string | null,
    targetProfile: {
      account_id: "acct-1",
      account_role: "instructor",
    },
    otherInstructorId: null as string | null,
  };

  it("aceita vínculo válido", () => {
    expect(evaluateLinkUser(base).ok).toBe(true);
  });

  it("rejeita se instructor já tem user", () => {
    const r = evaluateLinkUser({ ...base, instructorUserId: "u-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("instructor_already_linked");
  });

  it("rejeita user de outra conta", () => {
    const r = evaluateLinkUser({
      ...base,
      targetProfile: { account_id: "acct-2", account_role: "instructor" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("not_member");
  });

  it("rejeita role diferente de instructor", () => {
    const r = evaluateLinkUser({
      ...base,
      targetProfile: { account_id: "acct-1", account_role: "agent" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("wrong_role");
  });

  it("rejeita user já vinculado a outro instructor", () => {
    const r = evaluateLinkUser({ ...base, otherInstructorId: "inst-2" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("already_linked_elsewhere");
  });
});

describe("isUuid", () => {
  it("aceita UUID v4", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("rejeita lixo", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
  });
});
