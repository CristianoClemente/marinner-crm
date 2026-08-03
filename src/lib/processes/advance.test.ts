import { describe, expect, it } from "vitest";
import { resolveAdvance } from "./advance";
import type { ProcessTemplateStage } from "./types";

function stage(
  id: string,
  position: number,
  allow_skip = false,
): ProcessTemplateStage {
  return {
    id,
    account_id: "a",
    template_id: "t",
    name: id,
    position,
    allow_skip,
    accepts_classes: false,
    created_at: "",
  };
}

describe("resolveAdvance", () => {
  const stages = [stage("s0", 0), stage("s1", 1), stage("s2", 2, true)];

  it("avança para a próxima posição", () => {
    const r = resolveAdvance({ stages, currentStageId: "s0" });
    expect(r.ok && !r.complete && r.next.id).toBe("s1");
  });

  it("completa na última etapa", () => {
    const r = resolveAdvance({ stages, currentStageId: "s2" });
    expect(r).toEqual({ ok: true, complete: true });
  });

  it("bloqueia skip sem allow_skip", () => {
    const r = resolveAdvance({
      stages,
      currentStageId: "s0",
      targetStageId: "s2",
    });
    expect(r.ok).toBe(false);
  });

  it("permite skip com allow_skip na etapa atual", () => {
    const withSkip = [stage("s0", 0, true), stage("s1", 1), stage("s2", 2)];
    const r = resolveAdvance({
      stages: withSkip,
      currentStageId: "s0",
      targetStageId: "s2",
    });
    expect(r.ok && !r.complete && r.next.id).toBe("s2");
  });

  it("force permite pular", () => {
    const r = resolveAdvance({
      stages,
      currentStageId: "s0",
      targetStageId: "s2",
      force: true,
    });
    expect(r.ok && !r.complete && r.next.id).toBe("s2");
  });

  it("free permite ir para qualquer etapa com target", () => {
    const r = resolveAdvance({
      stages,
      currentStageId: "s2",
      targetStageId: "s0",
      advanceMode: "free",
    });
    expect(r.ok && !r.complete && r.next.id).toBe("s0");
  });

  it("free rejeita destino igual ao atual", () => {
    const r = resolveAdvance({
      stages,
      currentStageId: "s1",
      targetStageId: "s1",
      advanceMode: "free",
    });
    expect(r.ok).toBe(false);
  });

  it("free sem target avança sequencialmente", () => {
    const r = resolveAdvance({
      stages,
      currentStageId: "s0",
      advanceMode: "free",
    });
    expect(r.ok && !r.complete && r.next.id).toBe("s1");
  });
});
