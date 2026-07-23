import { getSessionContext } from "@/lib/data/session";

/**
 * The print route group. It inherits the root `<html dir lang>` + theme wiring,
 * but renders NONE of the app shell (no sidebar/nav) — these pages are meant to
 * be printed or saved as PDF. Auth is still enforced: getSessionContext()
 * redirects a signed-out visitor, exactly like the app layout's session read.
 */
export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await getSessionContext();
  return <>{children}</>;
}
