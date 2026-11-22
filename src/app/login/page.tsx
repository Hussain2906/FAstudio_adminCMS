"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { adminRoutes } from "../../config/routes";
import { getSafeLoginRedirect } from "../../config/login-redirect";
import { apiClient, ApiError } from "../../lib/api/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    try {
      await apiClient.post("auth/login", { email, password });
      const requestedPath = new URLSearchParams(window.location.search).get("from");
      const destination = getSafeLoginRedirect(
        requestedPath,
        window.location.origin,
        adminRoutes.dashboard,
      );
      router.replace(destination);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 429
          ? "Too many attempts. Try again later."
          : "Invalid email or password.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12 text-foreground">
      <section className="w-full max-w-md space-y-8 rounded-xl border border-border bg-card p-8 shadow-card">
        <header className="space-y-4">
          <div className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground">
            <LockKeyhole aria-hidden="true" className="size-5" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Interior Studio
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Sign in to Admin</h1>
            <p className="text-sm text-muted-foreground">
              Use your administrator credentials to continue.
            </p>
          </div>
        </header>
        <form className="space-y-5" onSubmit={submit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              autoComplete="email"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              autoComplete="current-password"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </div>
          {error ? (
            <p aria-live="polite" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <button
            className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
