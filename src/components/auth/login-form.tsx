"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UsersRound } from "lucide-react";
import { DEFAULT_LOGO_SRC } from "@/lib/brand";
import { getTenantUrl } from "@/lib/domain";
import type { AuthBrand } from "@/components/auth/auth-brand";

export type LoginLabels = {
  titleAccept: string;
  titleWelcome: string;
  descAccept: string;
  descWelcome: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  forgotPassword: string;
  passwordPlaceholder: string;
  signingIn: string;
  signIn: string;
  noAccount: string;
  createAccount: string;
};

export function LoginForm({
  labels,
  brand,
}: {
  labels: LoginLabels;
  brand?: AuthBrand | null;
}) {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const logoSrc = brand?.logoUrl || DEFAULT_LOGO_SRC;
  const welcomeDesc = brand
    ? `Entre na conta de ${brand.name}`
    : labels.descWelcome;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(translateAuthError(signInError.message));
      setLoading(false);
      return;
    }

    if (inviteToken) {
      window.location.href = `/join/${encodeURIComponent(inviteToken)}`;
      return;
    }

    // Já no tenant do Host → dashboard relativo.
    // No apex → se a account tem slug, vai para o subdomínio.
    if (brand) {
      window.location.href = "/dashboard";
      return;
    }

    try {
      const res = await fetch("/api/account");
      if (res.ok) {
        const body = (await res.json()) as {
          account?: { slug?: string | null };
        };
        const slug = body.account?.slug;
        if (slug) {
          window.location.href = getTenantUrl(slug, "/dashboard");
          return;
        }
      }
    } catch {
      // fallback abaixo
    }

    window.location.href = "/dashboard";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-primary/10 p-1.5">
            {inviteToken ? (
              <UsersRound className="h-6 w-6 text-primary" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt=""
                className="size-full object-contain"
              />
            )}
          </div>
          {brand && !inviteToken ? (
            <p className="text-sm font-medium text-foreground">{brand.name}</p>
          ) : null}
          <CardTitle className="text-xl text-foreground">
            {inviteToken ? labels.titleAccept : labels.titleWelcome}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {inviteToken ? labels.descAccept : welcomeDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-muted-foreground">
                {labels.emailLabel}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={labels.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-muted-foreground">
                  {labels.passwordLabel}
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:text-primary/80"
                >
                  {labels.forgotPassword}
                </Link>
              </div>
              <PasswordInput
                id="password"
                placeholder={labels.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? labels.signingIn : labels.signIn}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {labels.noAccount}{" "}
            <Link
              href={
                inviteToken
                  ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                  : "/signup"
              }
              className="text-primary hover:text-primary/80"
            >
              {labels.createAccount}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
