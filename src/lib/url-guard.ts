import "server-only";

import { lookup } from "node:dns/promises";

/**
 * THE SSRF GATE for the Inspiration URL capture.
 *
 * ⚠️ WHY THIS FILE EXISTS. `captureFromUrl` makes the server fetch a URL a
 * human typed. Without a guard, `http://169.254.169.254/latest/meta-data/`
 * turns a "save this picture" box into a cloud-credential reader, and
 * `http://localhost:54321` turns it into a proxy onto anything the runtime can
 * reach. Both are one paste away, which is exactly the kind of hole that gets
 * found by accident.
 *
 * The rule: only public, http(s), plainly-addressed hosts. Everything else is
 * refused before a socket is opened.
 */

/** Ports a normal website is served on. Anything else is a scan, not a page. */
const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);

export type UrlRejection =
  | "scheme"
  | "credentials"
  | "port"
  | "host"
  | "private"
  | "unresolvable";

export class UnsafeUrlError extends Error {
  constructor(readonly reason: UrlRejection) {
    super(`Unsafe URL: ${reason}`);
    this.name = "UnsafeUrlError";
  }
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) return true;
  const [a, b] = parts;

  return (
    a === 0 || //                0.0.0.0/8      "this network"
    a === 10 || //               10.0.0.0/8     private
    a === 127 || //              127.0.0.0/8    loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64/10  carrier-grade NAT
    (a === 169 && b === 254) || //           169.254/16 link-local — THE cloud
    //                                       metadata address lives here
    (a === 172 && b >= 16 && b <= 31) || //  172.16/12  private
    (a === 192 && b === 0) || //             192.0.0/24 IETF protocol assignments
    (a === 192 && b === 168) || //           192.168/16 private
    (a === 198 && (b === 18 || b === 19)) || // 198.18/15 benchmarking
    a >= 224 //                              224/4 multicast, 240/4 reserved
  );
}

function isPrivateIpv6(address: string): boolean {
  const value = address.toLowerCase().split("%")[0];

  // IPv4-mapped (::ffff:1.2.3.4) — unwrap and judge it as IPv4, or the whole
  // guard is bypassed by writing the loopback in v6 notation.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
  if (mapped) return isPrivateIpv4(mapped[1]);

  if (value === "::" || value === "::1") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(value)) return true; // fc00::/7 unique-local
  if (/^fe[89ab][0-9a-f]:/.test(value)) return true; // fe80::/10 link-local
  return false;
}

/**
 * Resolve a URL and refuse it unless every address it points at is public.
 *
 * ⚠️ ACCEPTED RESIDUAL RISK — DNS REBINDING. We resolve here, then `fetch`
 * resolves again; a hostile nameserver could answer differently the second
 * time. Closing that needs an undici Agent with a `connect` hook validating the
 * socket's peer address. For a two-person internal tool where the only person
 * pasting URLs is the owner, this is documented and accepted rather than built.
 * Revisit if this section ever accepts input from outside the company.
 */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("host");
  }

  // Blocks file:, data:, ftp:, gopher:, javascript: — several of which fetch
  // would happily read off the local disk.
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("scheme");
  }
  if (url.username || url.password) throw new UnsafeUrlError("credentials");
  if (!ALLOWED_PORTS.has(url.port)) throw new UnsafeUrlError("port");

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    // No dot means an intranet short name (`router`, `nas`) — never a site.
    !host.includes(".")
  ) {
    // A bare IPv6 literal has colons and no dots, so let it through to the
    // address check below rather than rejecting it as a short name.
    if (!host.includes(":")) throw new UnsafeUrlError("host");
  }

  // A literal address skips DNS entirely — judge it directly.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isPrivateIpv4(host)) throw new UnsafeUrlError("private");
    return url;
  }
  if (host.includes(":")) {
    if (isPrivateIpv6(host)) throw new UnsafeUrlError("private");
    return url;
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError("unresolvable");
  }
  if (addresses.length === 0) throw new UnsafeUrlError("unresolvable");

  // ⚠️ EVERY address must be public, not just the first. A host that resolves
  // to one public and one private address is a deliberate attack shape.
  for (const { address, family } of addresses) {
    const bad =
      family === 4 ? isPrivateIpv4(address) : isPrivateIpv6(address);
    if (bad) throw new UnsafeUrlError("private");
  }

  return url;
}
