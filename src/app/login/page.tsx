import { LoginForm } from "@/components/auth/login-form";
import { getT } from "@/lib/i18n/server";

export default async function LoginPage() {
  const t = await getT();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="animate-fade-rise w-full max-w-sm">
        <div className="mb-7">
          <p className="text-lg font-semibold tracking-tight text-ink">
            {t("app.name")}
          </p>
          <p className="mt-1 text-sm text-muted">{t("auth.signInSubtitle")}</p>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
