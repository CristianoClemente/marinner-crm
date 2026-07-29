import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/flows/admin-client", () => ({
  supabaseAdmin: () => ({ from }),
}));

const { clearTenantLookupCache, lookupTenantBySlug } = await import("./lookup");

describe("lookupTenantBySlug", () => {
  beforeEach(() => {
    clearTenantLookupCache();
    maybeSingle.mockReset();
    eq.mockClear();
    select.mockClear();
    from.mockClear();
  });

  it("retorna null para slug vazio", async () => {
    expect(await lookupTenantBySlug("  ")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("busca e cacheia o resultado", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: "a1",
        name: "Escola",
        slug: "escola",
        logo_url: "https://cdn/x.png",
      },
      error: null,
    });

    const first = await lookupTenantBySlug("Escola");
    const second = await lookupTenantBySlug("escola");

    expect(first).toEqual({
      id: "a1",
      name: "Escola",
      slug: "escola",
      logo_url: "https://cdn/x.png",
    });
    expect(second).toEqual(first);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("cacheia miss (null)", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await lookupTenantBySlug("sumiu")).toBeNull();
    expect(await lookupTenantBySlug("sumiu")).toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
  });
});
