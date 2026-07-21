"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

/**
 * The boundary every `rowsOrThrow` failure lands on. Without this, throwing on
 * a failed query would be worse than swallowing it — so this file is what
 * makes the "fail loudly" rule safe.
 *
 * ⚠️ It shows `digest`, NOT `error.message`. Next REDACTS the message in
 * production builds, so rendering it would print an empty string and read as a
 * bug in the error page itself. The digest is the value that cross-references
 * the server log.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full border border-line bg-danger-soft text-danger">
          <AlertTriangle aria-hidden className="size-5" />
        </div>

        <h1 className="text-base font-semibold text-ink">
          {t("common.somethingWentWrong")}
        </h1>
        <p className="mt-1.5 text-sm text-muted">{t("common.errorBoundaryBody")}</p>

        {error.digest && (
          <p className="mt-3 font-mono text-xs text-faint">
            {t("common.reference")}: {error.digest}
          </p>
        )}

        <Button variant="primary" onClick={reset} className="mt-5">
          {t("common.tryAgain")}
        </Button>
      </div>
    </div>
  );
}
