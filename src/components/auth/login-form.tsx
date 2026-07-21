"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { EmailInput, PasswordInput } from "@/components/ui/input";
import { signIn } from "@/lib/actions/auth";
import { useT } from "@/lib/i18n/client";

export function LoginForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await signIn(email, password);

    if (!result.ok) {
      setError(
        result.error === "invalid"
          ? t("auth.invalidCredentials")
          : t("auth.genericError")
      );
      setPending(false);
      return;
    }

    // The proxy stashed where they were headed before bouncing them here.
    const next = params.get("next");
    router.replace(next && next.startsWith("/") ? next : "/");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field id={emailId} label={t("auth.email")}>
        <EmailInput
          id={emailId}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
          required
          invalid={!!error}
        />
      </Field>

      <Field id={passwordId} label={t("auth.password")} error={error}>
        <PasswordInput
          id={passwordId}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          invalid={!!error}
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" full loading={pending}>
        {pending ? t("auth.signingIn") : t("auth.signIn")}
      </Button>
    </form>
  );
}
