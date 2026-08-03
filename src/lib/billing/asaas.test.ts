import { describe, expect, it, vi, afterEach } from "vitest";

vi.stubEnv("ASAAS_API_KEY", "test_key_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
vi.stubEnv("ASAAS_ENV", "sandbox");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("asaas client", () => {
  it("createCheckout envia POST /checkouts e resolve URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "chk_123", url: "https://sandbox.asaas.com/c/123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { createCheckout, resolveCheckoutUrl } = await import("./asaas");
    const checkout = await createCheckout({
      billingTypes: ["CREDIT_CARD", "PIX", "BOLETO"],
      chargeTypes: ["RECURRENT"],
      callback: {
        successUrl: "http://localhost:3000/dashboard",
        cancelUrl: "http://localhost:3000/billing/checkout?resume=1",
        expiredUrl: "http://localhost:3000/billing/checkout?resume=1",
      },
      items: [{ name: "Pro", quantity: 1, value: 397 }],
      subscription: { cycle: "MONTHLY", nextDueDate: "2026-08-16" },
      externalReference: "sub-local-1",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://sandbox.asaas.com/api/v3/checkouts");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).access_token).toBe(
      "test_key_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(resolveCheckoutUrl(checkout)).toBe(
      "https://sandbox.asaas.com/c/123",
    );
  });

  it("mapeia erro Asaas para mensagem amigável", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          errors: [{ code: "invalid_cpfCnpj", description: "CPF inválido" }],
        }),
      }),
    );

    const { createCustomer, AsaasError } = await import("./asaas");
    await expect(
      createCustomer({
        name: "Teste",
        email: "a@b.com",
        cpfCnpj: "000",
      }),
    ).rejects.toMatchObject({
      name: "AsaasError",
      message: "CPF inválido",
      status: 400,
    } satisfies Partial<InstanceType<typeof AsaasError>>);
  });
});
