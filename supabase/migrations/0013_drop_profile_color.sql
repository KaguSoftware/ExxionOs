-- 0013_drop_profile_color.sql — remove the per-member identity colour.
--
-- It was a setting that existed mainly to be configured. With two people, the
-- INITIALS on the avatar already say who is who, and an arbitrary per-user hue
-- competes with the reserved state vocabulary (success / warning / danger)
-- that the rest of the UI relies on to mean something specific.
--
-- Dropping it also removes the only raw hex values in the codebase — the
-- twenty-swatch `MEMBER_COLORS` list — restoring the "every colour resolves
-- through a token" rule that `globals.css` otherwise holds perfectly.
--
-- ⚠️ UNRELATED `color` COLUMNS STAY. `categories.color` (0003) and
-- `collections.color` (0004) are chart and cover colours for THINGS, not
-- people. They are a different feature that happens to share a column name.

alter table public.profiles drop column if exists color;

-- ⚠️ THE GRANT LIST MUST BE RE-ISSUED, NOT LEFT ALONE.
--
-- `profiles` has table-wide UPDATE revoked and per-column grants instead (see
-- 0001) — an RLS policy scopes the ROW, a GRANT scopes the COLUMN, and the two
-- are enforced independently. Dropping a column silently drops its grant with
-- it, so this re-states the surviving list explicitly rather than relying on
-- that side effect. The symptom of getting this wrong is a bare
-- "permission denied for table profiles" with nothing pointing at the cause.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, locale, theme) on public.profiles to authenticated;
