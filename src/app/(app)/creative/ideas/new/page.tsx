import { redirect } from "next/navigation";

/**
 * Ideas moved to /inspiration (0025) — they are pins now.
 *
 * This route stays as a redirect rather than being deleted: it was linked from
 * the Creative tab for months, so bookmarks and muscle memory both point here.
 * A 404 would read as "the feature was removed", which is the opposite of what
 * happened.
 */
export default function LegacyNewIdeaPage() {
  redirect("/inspiration/ideas/new");
}
