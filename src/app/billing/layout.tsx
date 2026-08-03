"use client";

import { AuthProvider } from "@/hooks/use-auth";

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}
