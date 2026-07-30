import { describe, expect, it } from "vitest";
import {
  effectiveQuotaBytes,
  formatBytesPt,
  retentionExpiresAt,
  sumActivePackageBytes,
  wouldExceedQuota,
} from "./chat-quota";

describe("sumActivePackageBytes", () => {
  it("soma só pacotes active na vigência", () => {
    const now = new Date("2026-07-30T12:00:00Z");
    const total = sumActivePackageBytes(
      [
        {
          extra_bytes: 5 * 1024 ** 3,
          status: "active",
          starts_at: "2026-01-01T00:00:00Z",
          ends_at: null,
        },
        {
          extra_bytes: 10 * 1024 ** 3,
          status: "canceled",
          starts_at: "2026-01-01T00:00:00Z",
          ends_at: null,
        },
        {
          extra_bytes: 2 * 1024 ** 3,
          status: "active",
          starts_at: "2026-01-01T00:00:00Z",
          ends_at: "2026-06-01T00:00:00Z",
        },
      ],
      now,
    );
    expect(total).toBe(5 * 1024 ** 3);
  });
});

describe("effectiveQuotaBytes", () => {
  it("base + extras", () => {
    const q = effectiveQuotaBytes(
      [
        {
          extra_bytes: 1024,
          status: "active",
          starts_at: "2020-01-01T00:00:00Z",
          ends_at: null,
        },
      ],
      1000,
      new Date("2026-01-01T00:00:00Z"),
    );
    expect(q).toBe(2024);
  });
});

describe("wouldExceedQuota", () => {
  it("bloqueia quando estoura", () => {
    expect(wouldExceedQuota(900, 200, 1000)).toBe(true);
    expect(wouldExceedQuota(800, 200, 1000)).toBe(false);
  });
});

describe("retentionExpiresAt", () => {
  it("soma dias em UTC", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const exp = retentionExpiresAt(from, 180);
    expect(exp.toISOString().slice(0, 10)).toBe("2026-06-30");
  });
});

describe("formatBytesPt", () => {
  it("formata GiB", () => {
    expect(formatBytesPt(5 * 1024 ** 3)).toMatch(/5 GB/);
  });
});
