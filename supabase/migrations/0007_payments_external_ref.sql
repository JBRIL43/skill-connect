-- Skill-Connect Ethiopia - tying a payments row to a Telebirr order
--
-- The C2B flow confirms payment out-of-band: after the SME pays, Telebirr POSTs
-- to notify_url from their own servers, with no session and no cookie. The only
-- thing linking that callback to a row here is the order number we invented and
-- sent as biz_content.merch_order_id, which comes back verbatim. Without
-- somewhere to store it there is no way to know which SME just paid.
--
-- Two columns, because they are ours and theirs respectively:
--   external_ref    the id we generate and send. Unique - it is the join key.
--   provider_tx_id  Telebirr's payment_order_id, recorded for reconciliation
--                   and so a support question has something to quote.

alter table public.payments
  add column if not exists external_ref text,
  add column if not exists provider_tx_id text;

comment on column public.payments.external_ref is
  'Our order number, sent to the provider as merch_order_id and echoed back on the webhook. The join key for reconciliation.';

comment on column public.payments.provider_tx_id is
  'The provider''s own transaction id (Telebirr payment_order_id). Recorded after confirmation, never matched on.';

-- Nullable rather than not null: this is an additive migration over a table that
-- may already hold rows, and a mock payment made before this shipped has no
-- reference to backfill. Postgres allows many nulls under a unique constraint,
-- so uniqueness still holds for every row that has one.
--
-- This also IS the webhook lookup index. A unique constraint is backed by a
-- btree, so adding a second index on external_ref would only cost writes.
create unique index if not exists payments_external_ref_key
  on public.payments (external_ref);

-- Telebirr rejects merch_order_id outside ^[A-Za-z0-9_]+$ (max 64) with a
-- generic failure that gives no hint about which field was wrong. Failing here
-- instead turns a confusing gateway error into an obvious constraint violation.
alter table public.payments
  drop constraint if exists payments_external_ref_format;

alter table public.payments
  add constraint payments_external_ref_format
  check (external_ref is null or external_ref ~ '^[A-Za-z0-9_]{1,64}$');

-- ---------------------------------------------------------------------------
-- Only the service role reconciles
-- ---------------------------------------------------------------------------
-- RLS already stops this: payments has select policies only, so an authenticated
-- user has no insert or update path at all. These grants are the same belt-and-
-- braces as 0005 - if someone later adds an "sme updates own payment" policy for
-- a plausible reason, the columns that decide whether money arrived still are not
-- theirs to write.

revoke insert, update on public.payments from authenticated, anon;
