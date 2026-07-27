import { createClient } from "@/lib/supabase/client";

/**
 * THE ONE IMAGE-UPLOAD CONTRACT.
 *
 * These rules lived inline in `image-strip.tsx` until the Inspiration dropzone
 * needed exactly the same ones. Two copies of "how big may a photo be" drift
 * the moment one of them is edited, and the symptom is a file the strip accepts
 * and the board rejects (or worse, the reverse). One module, one answer.
 *
 * ⚠️ UPLOADS GO BROWSER → BUCKET, never through the Next server. Only the
 * resulting path reaches a server action. A file that round-trips doubles the
 * transfer and holds a serverless function open for the whole upload.
 */

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Which entity the picture hangs off. Also the first path segment. */
export type ImageParent = "product" | "issue" | "idea";

export type UploadedImage = {
  path: string;
  /**
   * Intrinsic pixel size, decoded in the browser before upload.
   *
   * ⚠️ Null is a REAL ANSWER, not a failure to handle later. The masonry uses
   * these to reserve each card's box before its signed URL resolves; a null
   * pair falls back to 4:5 and the pin is still perfectly good. Never make the
   * upload fail because a decode did.
   */
  width: number | null;
  height: number | null;
};

/**
 * Why a file was refused. A caller maps this to a translated message — the
 * cap is ALWAYS announced, never silent. A photo that vanishes without a word
 * is the worst version of this.
 */
export type UploadRejection = "tooBig" | "wrongType" | "failed";

export type UploadOutcome =
  | { ok: true; image: UploadedImage }
  | { ok: false; reason: UploadRejection; message?: string };

/** Cheap client-side checks, so an oversized file never leaves the machine. */
export function checkImageFile(file: File): UploadRejection | null {
  if (file.size > IMAGE_MAX_BYTES) return "tooBig";
  if (!IMAGE_TYPES.includes(file.type)) return "wrongType";
  return null;
}

/**
 * Read a picture's intrinsic size without rendering it.
 *
 * `createImageBitmap` decodes off the main thread and is supported everywhere
 * this app runs; the `catch` covers a corrupt file or an animated WebP the
 * decoder dislikes. Failure returns nulls — see `UploadedImage.width`.
 */
async function readDimensions(
  file: File
): Promise<{ width: number | null; height: number | null }> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    // Frees the decoded pixels immediately rather than waiting for GC — a
    // twenty-file drop otherwise holds twenty full-size bitmaps at once.
    bitmap.close();
    return size;
  } catch {
    return { width: null, height: null };
  }
}

/**
 * Validate, decode and upload one image into the private `creative` bucket.
 *
 * The path is `${parent}/${parentId}/${uuid}.${ext}` — the shape every existing
 * caller already writes, so nothing in the bucket needs moving.
 */
export async function uploadImageToCreative(
  file: File,
  parent: ImageParent,
  parentId: string
): Promise<UploadOutcome> {
  const rejection = checkImageFile(file);
  if (rejection) return { ok: false, reason: rejection };

  const { width, height } = await readDimensions(file);

  const ext = file.name.split(".").pop() ?? "png";
  const path = `${parent}/${parentId}/${crypto.randomUUID()}.${ext}`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("creative")
    .upload(path, file, { upsert: false });

  if (error) return { ok: false, reason: "failed", message: error.message };
  return { ok: true, image: { path, width, height } };
}
