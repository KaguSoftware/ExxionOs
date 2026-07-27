/**
 * Open Graph parsing and image-header sniffing — pure, dependency-free, and
 * deliberately NOT in a `"use server"` file (those may only export async
 * functions, and these are called synchronously from the capture action).
 *
 * ⚠️ THIS IS A SCRAPER, AND SCRAPERS ARE WRONG SOMETIMES. Everything here
 * returns null rather than throwing, because a page that hides its picture must
 * still produce a usable link-only pin. Nothing the user typed is ever thrown
 * away on account of a missing meta tag.
 */

export type OpenGraph = {
  image: string | null;
  title: string | null;
  description: string | null;
  siteName: string | null;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  nbsp: " ",
};

/** Meta content arrives HTML-escaped; a title reading `Bob&#39;s vase` is a bug. */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    const key = code.toLowerCase();
    if (ENTITIES[key]) return ENTITIES[key];
    if (key.startsWith("#x")) {
      const n = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    if (key.startsWith("#")) {
      const n = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return whole;
  });
}

/**
 * Pull one `<meta>` value by its `property`/`name`.
 *
 * ⚠️ Attribute ORDER IS NOT FIXED in real HTML — `<meta content="…"
 * property="og:image">` is just as common as the other way round, and a regex
 * that only handles one order silently misses half the web. Hence two passes.
 */
function meta(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const propertyFirst = new RegExp(
    `<meta[^>]+(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*?content\\s*=\\s*["']([^"']*)["']`,
    "i"
  );
  const contentFirst = new RegExp(
    `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*?(?:property|name)\\s*=\\s*["']${escaped}["']`,
    "i"
  );

  const hit = propertyFirst.exec(html) ?? contentFirst.exec(html);
  const value = hit?.[1]?.trim();
  return value ? decodeEntities(value) : null;
}

/**
 * Read a page's social-preview metadata.
 *
 * The fallback chain is ordered by how much the site MEANT it: og:image is a
 * deliberate choice of preview picture, twitter:image usually the same one, and
 * `<link rel="image_src">` a much older convention still emitted by some shops.
 */
export function parseOpenGraph(html: string): OpenGraph {
  // Only the head can hold meta tags, and a 512KB body of product reviews
  // costs the regexes real time. Cut at </head> when there is one.
  const head = html.split(/<\/head>/i)[0] ?? html;

  const image =
    meta(head, "og:image:secure_url") ??
    meta(head, "og:image:url") ??
    meta(head, "og:image") ??
    meta(head, "twitter:image:src") ??
    meta(head, "twitter:image") ??
    /<link[^>]+rel\s*=\s*["']image_src["'][^>]*?href\s*=\s*["']([^"']+)["']/i
      .exec(head)?.[1] ??
    null;

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];

  return {
    image: image?.trim() || null,
    title:
      meta(head, "og:title") ??
      meta(head, "twitter:title") ??
      (titleTag ? decodeEntities(titleTag).trim() || null : null),
    description:
      meta(head, "og:description") ?? meta(head, "twitter:description"),
    siteName: meta(head, "og:site_name"),
  };
}

// --- image header sniffing -------------------------------------------------

/**
 * Read a picture's pixel size from its first few hundred bytes.
 *
 * ⚠️ WHY THIS EXISTS AT ALL. Browser-side uploads decode with
 * `createImageBitmap` (see `lib/upload.ts`), but an image fetched by the URL
 * capture never touches a browser — and a pin with no dimensions makes the
 * masonry reflow when its thumbnail lands. Thirty lines of header parsing beats
 * pulling in an image library for three formats we already restrict ourselves
 * to.
 *
 * Returns nulls on anything it doesn't recognise. That is a supported outcome,
 * not an error: the card falls back to 4:5.
 */
export function sniffImageSize(
  bytes: Uint8Array
): { width: number | null; height: number | null } {
  const none = { width: null, height: null };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // --- PNG: 8-byte signature, then IHDR whose width/height sit at 16 and 20.
  if (
    bytes.length > 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  // --- WebP: "RIFF" .... "WEBP" then one of three chunk layouts.
  if (
    bytes.length > 30 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === "VP8X") {
      // 24-bit little-endian, stored as (size - 1).
      const w = (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1;
      const h = (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) + 1;
      return { width: w, height: h };
    }
    if (chunk === "VP8 ") {
      // Lossy: 14 bits each, after the 3-byte start code at offset 23.
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }
    if (chunk === "VP8L") {
      // Lossless: 14 bits each, packed across four bytes from offset 21.
      const bits =
        bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    return none;
  }

  // --- JPEG: walk the marker chain to the first Start-Of-Frame.
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1; // Resync past fill bytes rather than giving up.
        continue;
      }
      const marker = bytes[offset + 1];
      // SOF0–SOF15, excluding the four that are not frame headers (C4 DHT,
      // C8 JPG, CC DAC) — those carry tables, not dimensions.
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        return {
          height: view.getUint16(offset + 5),
          width: view.getUint16(offset + 7),
        };
      }
      const length = view.getUint16(offset + 2);
      if (length < 2) return none; // Malformed; a zero length would loop forever.
      offset += 2 + length;
    }
  }

  return none;
}

/** The file extension for a content-type we accept. Null means "not an image
 *  we store" — the caller keeps the pin and skips the picture. */
export function imageExtension(contentType: string | null): string | null {
  const type = contentType?.split(";")[0]?.trim().toLowerCase();
  if (type === "image/png") return "png";
  if (type === "image/jpeg" || type === "image/jpg") return "jpg";
  if (type === "image/webp") return "webp";
  return null;
}
