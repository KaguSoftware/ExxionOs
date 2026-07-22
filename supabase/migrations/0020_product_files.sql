-- 0020_product_files.sql — Source/design files attached to a product.
--
-- A product has PHOTOS (product_images, 0004) for showing what it looks like.
-- This adds the other half: the SOURCE FILES it was modelled and sliced from —
-- .mb / .ma (Maya scenes) and .stl (the mesh) — so the design lives with the
-- product and can be re-printed or edited without hunting a hard drive.
--
-- ⚠️ These are DOWNLOADS, not thumbnails. They reuse the existing private
-- `creative` bucket (0004) — its read/write/update/delete policies are already
-- bucket-scoped to any authenticated user, so NO new storage policy is needed.
-- The file name and size are stored so the list can render without signing a
-- URL for every row (a URL is signed only at click, via SignedFileLink).

create table if not exists public.product_files (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  -- Storage path within the `creative` bucket, e.g.
  -- product-files/<product_id>/<uuid>.stl
  path        text not null,
  -- The original filename, shown in the list and used for the download.
  name        text not null,
  -- Bytes, for a human-readable size beside the name. Nullable — an old row or
  -- a failed stat shouldn't block the attach.
  size_bytes  bigint check (size_bytes is null or size_bytes >= 0),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists product_files_parent_idx
  on public.product_files (product_id, created_at desc);

alter table public.product_files enable row level security;

drop policy if exists product_files_all on public.product_files;
create policy product_files_all on public.product_files for all
  to authenticated using (true) with check (true);
