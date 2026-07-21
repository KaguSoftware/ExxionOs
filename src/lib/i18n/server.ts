import { cookies } from "next/headers";
import { cache } from "react";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  createTranslate,
  directionFor,
  isLocale,
  type Locale,
  type Translate,
} from "./index";

/**
 * The active locale for this request, read from the cookie.
 *
 * cache()-wrapped so the layout, the page and every server component in one
 * render share a single read rather than each hitting the cookie store.
 *
 * The cookie — not the profile — is the source consulted here, because this
 * runs in places that have no session (the login page). The layout keeps the
 * cookie in step with `profiles.locale` for signed-in users.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

/** Server-side `t()`. */
export const getT = cache(async (): Promise<Translate> => {
  return createTranslate(await getLocale());
});

export async function getDirection(): Promise<"ltr" | "rtl"> {
  return directionFor(await getLocale());
}
