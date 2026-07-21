import { LoginForm } from "@/components/auth/login-form";
import { Wordmark } from "@/components/shell/wordmark";
import { getT } from "@/lib/i18n/server";

export default async function LoginPage() {
  const t = await getT();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="animate-fade-rise w-full max-w-sm">
        {/* The one surface with room for the full lockup. It carries the
            brand colour itself rather than sitting on a blue field — a filled
            block here would fight the form below it for attention. */}
        <div className="mb-7">
          <Wordmark className="text-3xl text-brand-text" />
          <p className="mt-3 text-sm text-muted">
            {t("auth.signInSubtitle", { app: t("app.name") })}
          </p>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
