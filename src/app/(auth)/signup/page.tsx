import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { DEFAULT_FAVICON_SRC } from "@/lib/brand";
import { getRequestTenant } from "@/lib/tenant/request";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getRequestTenant();
  const icon = tenant?.logoUrl || DEFAULT_FAVICON_SRC;
  return {
    title: tenant ? `Criar conta — ${tenant.name}` : undefined,
    icons: {
      icon: [
        {
          url: icon,
          type: icon.endsWith(".svg") ? "image/svg+xml" : undefined,
        },
      ],
    },
  };
}

export default async function SignupPage() {
  const tenant = await getRequestTenant();
  const brand = tenant
    ? { name: tenant.name, logoUrl: tenant.logoUrl }
    : null;

  return <SignupForm brand={brand} />;
}
