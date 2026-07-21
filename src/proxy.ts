import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth"];

/**
 * Next 16 calls this `proxy.ts` (it was `middleware.ts` before).
 *
 * Its job is to refresh the auth token on every request and bounce signed-out
 * traffic to /login.
 *
 * ⚠️ PERFORMANCE, and it is worth ~300ms on EVERY request: use `getClaims()`,
 * not `getUser()`. `getUser()` is a full round-trip to the auth server. This
 * project uses asymmetric (ES256) JWT signing keys, so `getClaims()` verifies
 * the token LOCALLY against the project's JWKS while still refreshing it the
 * same way. On KaguOs this took /login from 318ms to 15ms.
 *
 * ⚠️ Do not move code between `createServerClient` and the `getClaims()` call,
 * and do not remove the call. The refresh is what keeps sessions alive; losing
 * it produces intermittent random logouts that are miserable to diagnose.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were headed so login can return them there.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (signedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and images — those need no session and
     * paying an auth check for a favicon is waste.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
