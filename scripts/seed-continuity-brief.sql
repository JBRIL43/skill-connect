-- A reviewed handover interview for the seeded transition posting.
--
-- Pillar 3b turns a resignation into a scored challenge, which needs a
-- continuity_briefs row with reviewed_by_employee = true. Dev 2 owns that table
-- and the interview flow that produces it; this is a stand-in so the Dev 3 path
-- is testable against the live schema before that lands. Replace it with a real
-- interview when Dev 2's flow is ready.
--
-- reviewed_by_employee is true here deliberately: an unreviewed brief is
-- unredacted, and nothing downstream may read one.
--
-- Idempotent, keyed on the posting. Attaches to whichever posting is flagged
-- is_transition_role rather than a hardcoded uuid, so it survives a reseed.
--
-- Run with: psql "$DBURL" -v ON_ERROR_STOP=1 -f scripts/seed-continuity-brief.sql

begin;

insert into public.continuity_briefs (
  posting_id, raw_interview_json, generated_brief, reviewed_by_employee
)
select
  p.id,
  jsonb_build_object(
    'role_title', 'Dispatch Coordinator',
    'recurring_tasks', jsonb_build_array(
      'Confirm farm arrival quantities by 5:30am and reconcile against yesterday''s orders',
      'Split the two vans across eight restaurants and two hotels before 6am loading',
      'Call the hotel by 4pm to confirm tomorrow''s quantity, which changes most days',
      'Log spoilage at the end of the day and decide what gets discounted or dropped'
    ),
    'tools', jsonb_build_array(
      'Shared spreadsheet for daily orders',
      'WhatsApp groups per customer',
      'Paper delivery notes signed by drivers'
    ),
    'shortcuts', jsonb_build_array(
      'Load the hotel order last so it comes off first, because their gate closes at 7am',
      'Never promise leafy greens on the second van in the afternoon'
    ),
    'coordinates_with', jsonb_build_array(
      'Two van drivers',
      'Farm liaison at the cooperative',
      'Kitchen managers at the two hotels'
    ),
    'notes', 'Outgoing coordinator gave four weeks notice and reviewed this before leaving.'
  ),
  'The Dispatch Coordinator role runs a fixed morning cycle: reconcile farm arrivals against the previous day''s orders before 5:30am, allocate two vans across ten customers before 6am loading, and confirm the largest hotel''s next-day quantity each afternoon because it changes with little notice. Priority when capacity is short is the hotel gate closing at 7am, then restaurants by delivery distance. End of day means logging spoilage and deciding discounts on produce that will not survive another day. The role coordinates continuously with two drivers, the cooperative''s farm liaison, and hotel kitchen managers, mostly over WhatsApp and a shared order spreadsheet.',
  true
from public.sme_postings p
where p.is_transition_role
  and not exists (
    select 1 from public.continuity_briefs b where b.posting_id = p.id
  );

commit;
