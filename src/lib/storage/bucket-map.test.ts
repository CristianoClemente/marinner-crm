import { describe, expect, it } from "vitest";
import {
  assertPathAllowed,
  buildObjectKey,
  isLogicalBucket,
} from "./bucket-map";

describe("isLogicalBucket", () => {
  it("aceita os buckets lógicos inclusive process-docs", () => {
    expect(isLogicalBucket("chat-media")).toBe(true);
    expect(isLogicalBucket("flow-media")).toBe(true);
    expect(isLogicalBucket("account-branding")).toBe(true);
    expect(isLogicalBucket("avatars")).toBe(true);
    expect(isLogicalBucket("process-docs")).toBe(true);
    expect(isLogicalBucket("other")).toBe(false);
  });
});

describe("buildObjectKey", () => {
  it("prefixa chat/", () => {
    const key = buildObjectKey({
      logicalBucket: "chat-media",
      accountId: "acc",
      userId: "u1",
      fileName: "a.png",
      now: 1,
    });
    expect(key).toBe("chat/account-acc/1-a.png");
  });

  it("avatars inclui userId", () => {
    const key = buildObjectKey({
      logicalBucket: "avatars",
      accountId: "acc",
      userId: "u1",
      fileName: "x.jpg",
      now: 2,
    });
    expect(key).toBe("avatars/account-acc/user-u1/avatar-2.jpg");
  });

  it("process-docs usa key estável por campo", () => {
    const key = buildObjectKey({
      logicalBucket: "process-docs",
      accountId: "acc",
      userId: "u1",
      fileName: "rg.pdf",
      processId: "p1",
      fieldId: "f1",
      now: 3,
    });
    expect(key).toBe("processes/account-acc/process-p1/field-f1.pdf");
  });
});

describe("assertPathAllowed", () => {
  it("rejeita path de outra conta", () => {
    expect(() =>
      assertPathAllowed({
        logicalBucket: "chat-media",
        path: "chat/account-other/1-a.png",
        accountId: "acc",
        userId: "u1",
      }),
    ).toThrow();
  });

  it("aceita path R2 da própria conta", () => {
    expect(() =>
      assertPathAllowed({
        logicalBucket: "chat-media",
        path: "chat/account-acc/1-a.png",
        accountId: "acc",
        userId: "u1",
      }),
    ).not.toThrow();
  });

  it("aceita process-docs da conta", () => {
    expect(() =>
      assertPathAllowed({
        logicalBucket: "process-docs",
        path: "processes/account-acc/process-p/field-f.pdf",
        accountId: "acc",
        userId: "u1",
      }),
    ).not.toThrow();
  });

  it("exige userId em avatars", () => {
    expect(() =>
      assertPathAllowed({
        logicalBucket: "avatars",
        path: "avatars/account-acc/user-other/avatar-1.jpg",
        accountId: "acc",
        userId: "u1",
      }),
    ).toThrow();
  });
});
