/**
 * Normalise a list of user-entered links: trim, cap length, prepend https://
 * when no scheme was typed, de-duplicate, cap the count. Lives outside the
 * "use server" action files so both forms and actions can share it.
 */
export function normaliseLinks(links: string[]): string[] {
  const out: string[] = [];
  for (const raw of links ?? []) {
    let url = raw.trim().slice(0, 500);
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    if (!out.includes(url)) out.push(url);
  }
  return out.slice(0, 20);
}

/** A short human label for a link: hostname plus a truncated path. */
export function linkLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    const label = `${parsed.hostname}${path}${parsed.search}`;
    return label.length > 60 ? `${label.slice(0, 57)}…` : label;
  } catch {
    return url.length > 60 ? `${url.slice(0, 57)}…` : url;
  }
}
