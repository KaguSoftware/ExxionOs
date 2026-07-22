-- 0019_order_campaign.sql — Optional campaign attribution on an order.
--
-- Phase 7's Marketing Insights deliberately reported NO ROI, because nothing in
-- the data linked an order to the campaign that produced it, and an invented
-- attribution number is worse than none — it gets believed and then spent
-- against (see the HANDOFF gotcha). This migration adds the ONE thing real ROI
-- needs: a link from an order to a campaign. It does not, and cannot, invent
-- attribution — it only lets a human record it when they know it.
--
-- ⚠️ NULLABLE, and null is the honest default: most orders have no known
-- campaign, exactly like `clients.source` null = "nobody asked". ROI is
-- reported ONLY over tagged orders, with the untagged count shown out loud, so
-- the figure never pretends to cover orders it can't see.
--
-- ⚠️ SET NULL, never cascade — matching every other order link (client_id,
-- product_id). Archiving/deleting a campaign must not delete the orders it won;
-- the sale still happened. (Campaigns archive rather than delete anyway.)

alter table public.orders
  add column if not exists campaign_id uuid
    references public.campaigns (id) on delete set null;

-- The ROI query filters orders by campaign, so an index earns its place.
create index if not exists orders_campaign_id_idx
  on public.orders (campaign_id)
  where campaign_id is not null;
