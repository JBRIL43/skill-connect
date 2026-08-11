# **Skill-Connect Ethiopia** 

**Individual Developer Task Breakdown** _Cursor AI Hackathon Ethiopia — 48-Hour Build_ 

Companion document to the Project Documentation & Hackathon Playbook. Every task below maps to a specific section of that document. Each teammate should read the whole document once, then work primarily from their own section. 

## **Table of Contents** 

## **How to Use This Document** 

This document breaks the four-pillar build (Section 3 of the Project Docs) into granular, ordered tasks for each of the three developers and the non-technical lead. Tasks are grouped into phases with a suggested hour range that lines up with the team's 48-hour schedule. 

Each role's section includes, in order: 

- A phase-by-phase task list, in build order, with checkboxes 

- Notes on technical decisions, edge cases, or judgment calls specific to that task 

- A Definition of Done — the bar for "this part is actually finished," not just started 

- A Dependencies list — what you're blocked on from teammates, and what you owe them 

Read your own section fully before starting. Skim the other three sections once so you know what's coming from whom and when — the Cross-Team Dependency Map at the end is the fastest way to check that. 

If a task doesn't fit in its hour range, that's a signal to simplify the implementation, not to skip the checkpoint review. When in doubt, build the simplest version that keeps the demo working (Section 0 of the Project Docs), note the shortcut taken, and move on. 

## **Dev 1 — Platform, Trust & Payments Lead** 

You own the foundation everyone else builds on: the database schema, authentication, Row Level Security, the admin console, and payments. Nothing here is glamorous in the demo, but a mistake here is the only category of bug that can end the demo (a data leak) or block it entirely (broken auth). Move carefully on RLS and schema; move fast on everything else. 

#### **Phase 1 — Environment & Scaffold** _(Hour 0–2)_ 

☐  Create the Supabase project. Generate and record the project URL, anon key, and service role key. 

☐  Share credentials with the team via the private secrets channel — never commit them. ☐  Initialize the Next.js 15 project (App Router) with Tailwind CSS and Shadcn UI installed. ☐  Create .env.example listing every required variable as a placeholder: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, 

SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY (or GEMINI_API_KEY), TELEBIRR_MERCHANT_ID, TELEBIRR_API_KEY, TELEBIRR_SANDBOX_URL. 

☐  Confirm .env and .env.local are in .gitignore before the first commit that could contain a real value. 

☐  Push the initial scaffold to main. Connect the repo to Vercel so every branch gets a preview URL and main auto-deploys. 

☐  Post the Supabase project link and the Vercel project link to the team channel. 

#### **Phase 2 — Database Schema** _(Hour 2–6)_ 

☐  Build the full schema from Section 8 of the Project Docs as Supabase migration files: profiles, company_profiles, skill_matrices, sandbox_scores, badges, role_skill_templates, sme_postings, continuity_briefs, matches, notifications, payments. 

☐  Create every ENUM exactly as specified: role (job_seeker/sme/admin), mode (standard/pressure_simulation), sme_postings.status (open/filled), matches.status (suggested/shortlisted/hired), payments.provider (telebirr/chapa/mock), payments.status (pending/paid). 

☐  Enable the pgvector extension now, even though Dev 3 won't use it until the match engine phase — extension enablement can be finicky, get it working early. 

☐  Add one field the Section 8 schema doesn't explicitly list but Section 9's trust model requires: profiles.opt_in_discoverable BOOLEAN DEFAULT FALSE. Flag this addition to the team — every other dev needs to know it exists. 

☐  Keep every table flat, exactly as instructed in Section 8 — do not add extra normalization tables under time pressure. 

☐  Push the migration. Confirm every table is visible and correctly typed in Supabase Studio → Table Editor. 

☐  Announce in the team channel: "schema is live, pull before you write any DB code." This is the single most important message you send all hackathon. 

_The schema file is yours alone to edit for the whole 48 hours. If Dev 2 or Dev 3 needs a new column or table, they tell you the requirement in plain language and you make the change — this avoids migration conflicts, which are the ugliest kind of merge conflict to untangle at hour 30._ 

#### **Phase 3 — Auth & Role Routing** _(Hour 2–6 (parallel with Phase 2 once schema is drafted))_ 

☐  Set up Supabase Auth for email or phone signup, per the User Roles table in Section 4. 

☐  Build /signup and /login pages. On signup, insert a row into profiles with the selected role (job_seeker or sme). 

☐  For sme signups, treat company_profiles.verified = false as the "pending_verification" state described in Section 4 — there's no separate status field for it in the schema, this is the mapping to use. 

☐  Build the post-auth role check: after login, read profiles.role and route job_seeker → /dashboard, sme → /dashboard (sme view), admin → /admin. 

☐  Admin accounts are never self-serve (Section 4). Implement both documented paths: (a) manually flip a seed user's role to admin in Supabase Studio, and (b) the hackathon-only /admin/promote route gated by a hardcoded invite code, as a backup if you need to promote someone quickly on-site. 

☐  Create one test account per role and confirm each lands on the correct page after login. 

#### **Phase 4 — Row Level Security Policies** _(Hour 6–10)_ 

☐  Enable RLS on all 11 tables before writing a single policy — a table with RLS enabled and zero policies is the safe default (deny-all) while you build the real ones. 

☐  profiles: a user can select/update only their own row; admin can select all. 

☐  skill_matrices: selectable only by the owning user_id and admin. An sme must never be able to query this table directly, even for a candidate who matched to them — they only ever see derived output through the matches table (Section 9's core rule). 

☐  sandbox_scores: same visibility rule as skill_matrices — private to the owner and admin. 

☐  badges: owner can select/update their own; consider allowing public select only for badges on profiles the user has explicitly made public, otherwise default private. 

☐  role_skill_templates: an sme can select/insert/update only rows where sme_id matches their own profile id. 

☐  sme_postings: open postings are readable by any authenticated job_seeker for browsing; full CRUD restricted to the owning sme_id. 

☐  continuity_briefs: selectable only by the sme_id on the linked sme_postings row, AND only where reviewed_by_employee = true. This is a double gate — never expose an unreviewed brief, even to the SME who owns it. 

☐  matches: a candidate can select their own rows; an sme can select rows only for their own postings, and only the derived columns (match_score, gap_analysis, status) — never anything that would expose the candidate's raw skill matrix. 

☐  notifications: selectable only by the owning sme_id. 

☐  payments: selectable only by the owning sme_id; admin can select all. 

☐  Write a short RLS test script (or a manual checklist you run twice) that logs in as job_seeker A and attempts to query job_seeker B's skill_matrices and sandbox_scores directly — must return empty or an authorization error, never data. 

☐  Repeat as an sme account attempting to query any candidate's skill_matrices table directly, bypassing the matches table — must be denied. 

☐  Write a one-page plain-English summary of these policies. This becomes your talking point for the Ethio Telecom technical deep-dive (Section 14) — judges specifically respond well to a real RLS model. 

#### **Phase 5 — Notifications Backend** _(Hour 10–16)_ 

☐  Design the check: after any sandbox_scores write, compare the candidate's latest scores against every role_skill_templates row where notify_on_match = true. 

☐  Only evaluate candidates where profiles.opt_in_discoverable = true — this is Section 9's opt-in rule enforced at the point of notification, not just at query time. 

☐  For a hackathon timeline, implement this as an API route (/api/notifications/check) called by Dev 3 right after a challenge is graded, rather than a Postgres trigger — faster to build and debug in 48 hours. 

☐  If a candidate clears a template's thresholds_json and no existing notifications row already exists for that (sme_id, template_id, candidate_id) combination, insert one. 

☐  Test manually: push a mock candidate's score above a test template's threshold, confirm exactly one notification appears, then repeat the same check and confirm no duplicate is created. 

#### **Phase 6 — Admin Console** _(Hour 10–20)_ 

☐  Build /app/admin/page.tsx, protected so only role = admin can load it — check this server-side, not just by hiding a nav link. 

☐  Live counters: total job_seekers, total smes, total postings, total matches made, total transition roles in progress. Simple count queries are fine; refresh on load or poll every ~30 seconds. 

☐  Searchable table of all skill matrices and sandbox scores, using the service role key server-side only (never expose this key to the client) — this is your live debugging and demo-recovery view. ☐  Build the "seed demo data" button: a server action that reads the two static JSON files from the non-technical lead (job-seeker personas, SME personas) and bulk-inserts profiles, company_profiles, skill_matrices, sandbox_scores, badges, and role_skill_templates in one transaction. 

☐  Make the seed action idempotent — tag seeded rows (e.g. a boolean or a naming convention) so clicking the button twice doesn't duplicate data. This button is your entire fallback plan if live AI calls fail during judging, so it needs to be boring and reliable, not clever. 

☐  Build the SME verification approve/reject toggle, flipping company_profiles.verified. 

☐  Test the seed button at least three separate times against the live schema before demo freeze. 

#### **Phase 7 — Payments** _(Hour 20–30)_ 

☐  Check with the non-technical lead: has the Telebirr sandbox credential request from Section 0.5 been approved yet? This is a go/no-go decision point. 

☐  If credentials have arrived: build /app/api/payments/telebirr-checkout using the real sandbox credentials for the SME "Upgrade" flow. On success, write a payments row with provider = telebirr, status = paid. 

☐  If credentials have not arrived: build a Telebirr-styled mock checkout UI instead — ask the nontechnical lead for reference screenshots of the real flow so the mock is visually convincing. Same payments row write, but provider = mock. 

☐  Either way, build the trigger UI: SME clicks "Upgrade" on their dashboard → checkout → on success, unlock premium features (auto-notify templates, priority handover). 

☐  In the pitch, be explicit about which path was used — Section 6 and 14 both stress that honesty about what's real vs. mocked reads as strength to judges, not weakness. 

☐  Test the full checkout flow at least twice. 

#### **Phase 8 — Final Hardening & Freeze** _(Hour 36–48)_ 

☐  Re-run the full RLS test suite from Phase 4 as both a job_seeker and an sme account. Do this even if nothing has changed — schema or policy drift happens. 

- ☐  Confirm the seed-data button still works cleanly against the final schema state. 

- ☐  Watch the admin counters update live during at least one full scripted demo run-through. ☐  After Hour 40: bugfixes only, no new features, even small ones. 

#### **Definition of Done** 

- ☐  All 11 tables live, RLS enabled, and tested from both a job_seeker and an sme account ☐  Auth and role routing correctly redirect all three roles 

- ☐  Admin console counters are accurate and the seed-data button is reliable on repeat clicks 

- ☐  Payment flow (real or mock) completes and writes a correct payments row ☐  Notifications fire on threshold-clear and never duplicate 

#### **Dependencies (what you need from others / what others need from you)** 

- You owe Dev 2 and Dev 3 a live schema by Hour 6 — they cannot write real DB code before this. 

- You owe the whole team the opt_in_discoverable field decision early — Dev 3's match engine and Dev 2's "share my scores" UI both depend on it existing. 

- You need the two seed JSON files from the non-technical lead by roughly Hour 16–20 to finish and test the seed-data button. 

- You need a Telebirr credential status update from the non-technical lead by roughly Hour 20 to decide real-vs-mock payments. 

## **Dev 2 — AI Coach Lead** 

You build the conversational engine that powers three different surfaces in the product: the Pillar 1 intake coach, the site-wide chatbot bubble, and the Pillar 3b handover interview. These should be one reusable engine with three prompt variants — not three separate systems. Building it that way is explicitly why Pillar 3b and the chatbot bubble are cheap additions instead of a second build (Sections 1 and 3). 

#### **Phase 1 — Scaffold** _(Hour 0–2)_ 

☐  Pull the schema the moment Dev 1 announces it's live. 

☐  Set up /app/coach, install the Vercel AI SDK, and connect your LLM provider key (OpenAI or Gemini). 

☐  Build a minimal streaming chat UI — message list plus input — and confirm token-by-token streaming works end-to-end with a placeholder system prompt before investing in the real one. 

#### **Phase 2 — Intake Conversation Engine** _(Hour 2–10)_ 

☐  Design the system prompt for the AI career coach: conversational and natural, not rigid multiple choice, and able to run in either Amharic or English (Section 3, Pillar 1). 

☐  Have the coach ask about background, interests, current skills, work style, and constraints — enough to surface both technical/AI skills and latent human skills like adaptability, problem-solving, and empathy. 

☐  Design the structured output contract: once the conversation has enough signal, the model should emit a skill matrix as JSON. Suggested shape to match skill_matrices.skills_json: technical competency scores, human/soft-skill scores, and a short raw_notes field. 

☐  Label this output clearly in the UI as the coach's own initial read, not a Sandbox Score — only AIgraded challenges in Pillar 2 produce a verified Sandbox Score (Section 2). Conflating the two would undercut the platform's core credibility claim. 

☐  Use the Vercel AI SDK's structured-output or tool-calling support to get reliable JSON out of the model — don't rely on hoping the model formats plain text correctly. 

☐  On a valid JSON result, write to skill_matrices (user_id, skills_json, a placeholder readiness_score). 

☐  Test the full conversation in both Amharic and English at least three times each, and confirm JSON extraction doesn't break when the transcript contains Amharic script. 

#### **Phase 3 — Skill Radar Visualization** _(Hour 8–14)_ 

☐  Build a radar chart component (Recharts or a custom SVG) that renders live from skills_json. 

☐  Animate it in on first render — Framer Motion is fine to defer to the polish pass if time is tight. 

☐  Confirm it renders correctly with any Amharic labels in place, using the Noto Sans Ethiopic font the non-technical lead is sourcing. 

#### **Phase 4 — Career Recommendations** _(Hour 14–18)_ 

☐  From a completed skill matrix, prompt the model to recommend 2–3 AI-resilient career paths. 

☐  Get the list of available Sandbox node_ids and what skill each one targets from Dev 3, and map each recommendation to specific real challenges — not placeholder text. 

☐  Render as cards: path name, a short reason it fits, and a "start these challenges" link into Dev 3's /app/sandbox with the relevant node highlighted. 

#### **Phase 5 — Site-Wide "Ask Skill-Connect" Chatbot Bubble** _(Hour 18–22)_ 

☐  Reuse the exact engine and streaming setup from Phase 2 — do not stand up a second chat system for this. 

☐  Wrap it in a small floating bubble component placed in the root layout so it's available on every page. 

☐  Write a second prompt variant: instead of extracting a skill matrix, this instance answers plainEnglish product questions like "how does matching work?" or "how do I post a transition role?" — give it condensed context from Sections 2, 5, and 9 of the Project Docs so its answers are accurate. 

☐  Test 5–10 realistic questions from both a job-seeker's and an sme's perspective. 

#### **Phase 6 — Pillar 3b: AI Handover Interview** _(Hour 24–34)_ 

☐  Reuse the Phase 2 engine again with a third prompt variant: interview the outgoing employee about recurring tasks, tools, shortcuts, and who they coordinate with. 

☐  Store the raw conversation as continuity_briefs.raw_interview_json (linked via posting_id). 

☐  Run a separate summarization call to turn the raw interview into generated_brief — a clean, readable Continuity Brief document. 

☐  Build the review/redaction UI: show the outgoing employee the generated brief and let them edit or remove client names or internal specifics before anything is marked usable. 

☐  Only flip continuity_briefs.reviewed_by_employee to true after the employee has explicitly confirmed — Dev 1's RLS policy enforces that unreviewed briefs are unqueryable, so this flag is loadbearing, not cosmetic. 

☐  Coordinate the exact shape of raw_interview_json with Dev 3 by roughly Hour 24 — it's the input to their custom challenge generation in Phase 8 of their track. 

#### **Definition of Done** 

☐  Intake conversation completes reliably in both Amharic and English and writes a valid skill_matrices row 

☐  Skill Radar renders correctly from real, non-placeholder data 

☐  2–3 career recommendations generated and linked to real Sandbox node_ids, not placeholder text 

☐  Chatbot bubble answers at least 5 realistic test questions accurately 

☐  Handover interview → generated brief → redaction gate all function, and the reviewed flag correctly controls visibility 

#### **Dependencies (what you need from others / what others need from you)** 

- You need the schema live from Dev 1 by Hour 6. 

- You need Dev 3's Sandbox node_id list and skill mapping by roughly Hour 14 to build real career recommendation links. 

- You owe Dev 3 the exact shape of raw_interview_json by roughly Hour 24 so they can build custom challenge generation on top of it. 

- Confirm with Dev 1 that opt_in_discoverable exists before wiring any UI that lets a candidate toggle sharing their scores. 

## **Dev 3 — Sandbox & SME Matcher Lead** 

You own the two pillars that make the platform's core claim real: Pillar 2 (challenges that produce a verified score, not a self-report) and Pillar 3 (matching companies to that verified score). Build one sandbox challenge completely, end-to-end, before cloning the pattern — resist the urge to scaffold all three at once, since one working example de-risks the other two. 

#### **Phase 1 — Scaffold** _(Hour 0–2)_ 

☐  Pull the schema the moment Dev 1 announces it's live. 

☐  Install @xyflow/react and scaffold /app/sandbox with 3–4 static placeholder nodes to confirm the library renders before wiring any real logic. 

#### **Phase 2 — First Full Challenge, End-to-End** _(Hour 2–10)_ 

☐  Pick the first challenge: the Section 3 example, "Help a Merkato textile shop write a WhatsApp catalog with AI," is a ready-made starting point. 

☐  Build the node UI: a challenge brief plus an embedded AI assistant chat — the user solves the challenge with AI help, they aren't being tested on unassisted work. 

☐  Build the grading step: on submission, send the user's work plus a visible rubric to the model and get back per-competency scores, e.g. prompt_engineering, task_accuracy, communication. 

☐  Write the result to sandbox_scores (user_id, node_id, scores_json, mode = 'standard', completed_at). 

☐  On success, insert a badges row (user_id, node_id, badge_name, awarded_at). 

☐  Build the "graded score reveal + badge pop" UI moment carefully — this is the single visual beat the Section 13 demo script calls out by name ("show the graded score appear, badge pops"), so it's worth extra polish time relative to other UI. 

☐  Test the full loop at least three times and confirm scores and badges persist correctly. 

#### **Phase 3 — Clone Two More Challenges** _(Hour 10–16)_ 

☐  Reuse the exact component and grading pattern from Phase 2 — only the content, rubric, and node_id should change. 

☐  Pick two more localized micro-challenges from sectors that will also appear in the seed personas (retail, logistics, or agritech) so demo data lines up naturally. 

☐  Confirm the node tree UI shows all challenges positioned sensibly. Dynamic generation per user's skill matrix is the documented target (Section 3); a static tree is an acceptable fallback if time is tight. 

#### **Phase 4 — Company Profile Page** _(Hour 14–18)_ 

☐  Build /app/company-profile/[id]: a public page showing logo, industry, size, an "AI-adoption journey" blurb, and a track record of roles filled (count matches where status = hired). 

☐  Build the SME-side edit form for their own profile. 

☐  Display the "AI-Forward Business" badge for profiles where verified = true (Section 5). 

#### **Phase 5 — Role Skill Template Builder** _(Hour 16–20)_ 

☐  Build the SME-facing form: a role name plus a threshold checklist (competency + minimum score), saved to role_skill_templates. 

☐  Also build the plain-language path from Section 3: an SME types a free-text problem like "I need someone to automate my retail inventory," and the system proposes a draft template via an LLM call, which the SME then confirms or edits before saving. 

#### **Phase 6 — Semantic + Threshold Match Engine** _(Hour 20–28)_ 

☐  Set up pgvector-backed semantic search: embed each candidate's skill/score profile and each template or posting description, and compute similarity. 

☐  Combine semantic similarity with hard threshold filtering — a candidate must actually clear thresholds_json to appear as a match — and require profiles.opt_in_discoverable = true. Never match a candidate who hasn't opted in, per Section 9. 

☐  Return a ranked candidate list with a Match Score (0–100%) and an LLM-generated Gap Analysis ("candidate is strong in X, would need onboarding in Y"). 

☐  Confirm your query only ever selects derived fields — scores and gap text — never raw skill_matrices content. Check with Dev 1 that RLS backs this up as a second layer rather than relying on query discipline alone. 

☐  Build the results UI: ranked list, Match Score badge, Gap Analysis text, and 1-click shortlist/hire buttons that update matches.status. 

#### **Phase 7 — Notifications UI** _(Hour 26–30)_ 

☐  Build the SME-facing notification list or bell icon, reading from Dev 1's notifications table. 

☐  Mark seen = true on open. 

☐  Test the full loop with Dev 1: a candidate clears a threshold → a notification appears here without a page reload delay that would read badly on stage. 

#### **Phase 8 — Pillar 3b: Custom Challenge Generation** _(Hour 28–36)_ 

☐  Take Dev 2's raw_interview_json from a continuity_briefs row where reviewed_by_employee = true — never from an unreviewed one. 

☐  Reuse your Phase 2 challenge-generation and grading logic, but seed the challenge content from the real job description instead of a generic template. 

☐  Write the generated challenge's identifier to continuity_briefs.custom_node_id. 

☐  Route incoming candidates for that transition posting to be scored against this specific challenge instead of a generic rubric. 

☐  If time allows: support "training mode," reusing the same challenge for onboarding once someone is hired (Section 2, point 4). 

#### **Phase 9 — Stretch: Workplace Pressure Simulation** _(Only if ahead of schedule)_ 

☐  Add a mode toggle on select sandbox nodes, writing mode = 'pressure_simulation' to sandbox_scores. 

☐  Write the "strict manager" system prompt to stay critical of the work product only, never of the person — no identity-linked discouragement — with a visible, always-available toggle back to supportive coaching mode (Section 9's bounded rule). 

☐  Test the tone yourself first. Per the Risk Register, if it reads as mean rather than "tough but fair," cut it from the live demo entirely rather than risk it landing badly in front of judges. 

#### **Definition of Done** 

- ☐  At least 3 sandbox challenges work fully end-to-end: submit, grade, score, badge 

- ☐  Company Profile pages work for both public viewing and SME self-editing 

- ☐  Role Skill Template builder works via both the manual form and the free-text path 

- ☐  Match engine returns ranked results that respect opt-in and thresholds and never exposes raw candidate data 

- ☐  Shortlist/hire buttons correctly update match status 

- ☐  Custom challenge generation works from a real, reviewed handover interview 

#### **Dependencies (what you need from others / what others need from you)** 

- You need the schema live from Dev 1 by Hour 6. 

- You need Dev 1 to confirm opt_in_discoverable and the notifications table before you start the Match Engine phase. 

- You need Dev 2's raw_interview_json shape and at least one reviewed continuity_brief by roughly Hour 28 to build custom challenge generation. 

- You owe Dev 2 your Sandbox node_id list and skill mapping by roughly Hour 14 so their career recommendations can link to real challenges. 

## **Non-Technical Teammate — Product, Data & Pitch Lead** 

You're not writing application code, but three of your workstreams are hard blockers for the technical team, and one bug you catch in QA is worth more than a feature. Treat the Hour 0 registration step as truly first — it's the one task on this entire 48-hour plan with an external approval delay outside anyone's control. 

#### **Phase 1 — Ethio Telecom Registration** _(Hour 0, before anything else)_ 

☐  Register at developer.ethiotelecom.et using the exact same email address used to register on Luma (Section 0.5 — mismatched emails can delay approval). 

☐  Immediately after registering, request demo/sandbox Telebirr API credentials. 

☐  Check email and the developer dashboard for approval at least every 2 hours through roughly Hour 20 — this blocks Dev 1's Phase 7. 

☐  The moment credentials arrive, post them to the private secrets channel and message Dev 1 directly rather than waiting for them to ask. 

#### **Phase 2 — Job-Seeker Personas** _(Hour 0–10)_ 

☐  Prompt an LLM directly (outside the app) for roughly 20 realistic Ethiopian job-seeker personas per Section 11: name, background, and a short story, spread across sectors like retail, textiles, logistics, and agritech. 

☐  Pre-assign each persona a plausible skills_json and sandbox_scores value — coordinate the exact field names and shape with Dev 1 and Dev 2 so it matches the live schema precisely, not an approximation. 

☐  Save as a single static JSON file, e.g. seed-job-seekers.json. 

☐  Never use real people's names or photos — entirely synthetic, per Section 11's hard rule. 

#### **Phase 3 — SME Personas** _(Hour 6–14)_ 

☐  Generate 8–10 fictional company profiles modeled on common Addis Ababa small-business sectors (Section 11). 

☐  Use invented company names only — never a real, identifiable business, and never Ethio Telecom's name or brand in demo data. 

☐  Give each fictional SME at least one saved Role Skill Template with realistic thresholds. 

☐  Save as seed-smes.json, matching Dev 1's schema and Dev 3's role_skill_templates shape exactly. 

#### **Phase 4 — Localization & Polish Assets** _(Hour 10–20)_ 

☐  Draft Amharic labels for key UI strings — navigation items, buttons, headers — and hand off a simple English-to-Amharic key/value list to Dev 2 and Dev 3. 

☐  Confirm Noto Sans Ethiopic (or an equivalent Unicode Ethiopic-script font) is in use, and specifically test that it renders correctly on the actual demo machine, not just your own laptop — this is a named Risk Register item. 

☐  Source or design simple placeholder logos for the fictional SMEs. 

#### **Phase 5 — QA: RLS & Flow Testing** _(Hour 16–24, repeat at Hour 36)_ 

☐  Create one test job_seeker account and one test sme account. 

☐  As the sme account, actively try to view the job_seeker's raw skill matrix or conversation transcript directly — through URL manipulation, devtools, or any other route you can think of. Confirm it's blocked. Any leak is a P0, report to Dev 1 immediately. 

As one job_seeker account, try to view another job_seeker's data. Confirm it's blocked. 

☐ 

☐  Walk every pillar's happy path once real seed data is loaded. Log anything broken or confusing to the team channel with a screenshot — don't just mention it verbally and let it get lost. 

#### **Phase 6 — Demo Insurance** _(Hour 20–30)_ 

☐  Once Dev 2's Pillar 1 flow is stable, record a 30-second backup video on a phone of the AI coach conversation completing successfully — this is the Risk Register's named fallback if live AI calls are slow or fail during judging. 

☐  Confirm the video plays back cleanly and is reachable without needing wifi on demo day. 

#### **Phase 7 — Pitch Materials** _(Hour 10–40, ongoing)_ 

☐  Draft the 60-second elevator pitch: hook, problem, and the four pillars in one sentence each (Section 14). 

☐  Draft the 2–3 minute technical deep-dive script for Ethio Telecom specifically, covering the Vercel AI SDK streaming route, the pgvector match query, the RLS policies, and the Telebirr integration — coordinate with all three devs so the script matches what's actually built, not the original plan. 

☐  Rehearse the Section 13 two-minute demo script with the full team at least twice before Hour 44. 

☐  Prepare clear talking points on what's live versus mocked, per Sections 6 and 14 — this reads as engineering maturity to judges, not a weak spot to hide. 

#### **Phase 8 — Judge & Investor Coordination** _(Hour 44–48 and live during judging)_ 

☐  Run a 10-minute cross-brief where every teammate explains at least one pillar they didn't personally build (Section 14). 

- ☐  Assign a rotating "first responder" for whenever someone new walks up to the table. 

☐  Actively look for a natural moment to mention the Telebirr integration to any Ethio Telecom representative who visits (Section 14). 

#### **Definition of Done** 

☐  Telebirr registration and credential status resolved — or confirmed as "not arriving," so Dev 1 can commit to the mock fallback — by roughly Hour 20 

Both seed JSON files delivered to Dev 1 by roughly Hour 16–20 

☐ 

- ☐  RLS QA pass completed twice, with zero known data leaks at demo freeze 

- Backup video recorded and verified to play offline 

- ☐ 

- ☐  Both pitches written and rehearsed, and every teammate can deliver the technical deep-dive if needed 

#### **Dependencies (what you need from others / what others need from you)** 

- You need Dev 1's finalized schema field names before locking the shape of your seed JSON files. 

- You need Dev 3's chosen sandbox challenge sectors before finalizing which persona sectors to generate. 

- You need Dev 2's Pillar 1 flow to be stable before recording the backup video. 

## **Cross-Team Dependency Map** 

A quick-reference view of every hand-off in the plan above. If you're ever unsure whether you're blocked on someone, check here before asking in the group chat. 

|From|Gives what|To|Byroughly|
|---|---|---|---|
|Dev 1|Live database schema, pushed and<br>announced<br>|Dev 2 & Dev 3|Hour 6|
|Dev 1|Confrmaton that<br>opt_in_discoverable exists and its<br>exact feld name|Dev 2 & Dev 3|Hour 10|
|Dev 3|Sandbox node_id list and the skill<br>each node targets<br>|Dev 2|Hour 14|
|Non-Tech|Seed JSON shape confrmed against<br>schema feld names|Dev 1|Hour 16|
|Non-Tech|Job-seeker and SME seed JSON<br>fles,fnal<br>|Dev 1|Hour 16–20|
|Non-Tech|Telebirr credental status (arrived /<br>not arrived)|Dev 1|Hour 20|
|Dev 2|raw_interview_json shape and one<br>reviewed contnuity_brief<br>|Dev 3|Hour 24–28|
|Dev 2|Stable Pillar 1 fow,readyto flm<br>|Non-Tech|Hour 20–24|
|Dev 1 / Dev 3|notfcatons table wired and<br>confrmed working|Dev 3|Hour 26|
|All Devs|What's actually live vs. mocked, for<br>thepitch script|Non-Tech|Hour 36–40|



## **Master Demo-Readiness Checklist** 

Run through this together as a team at the Hour 44–46 rehearsal block, before the final freeze. 

### **Security (never skip, even if behind schedule)** 

- ☐  RLS re-tested as both a job_seeker and an sme account, on the final schema state 

- ☐  No path exists for an sme to view a candidate's raw skill matrix or conversation transcript 

- ☐  Continuity Briefs are unreachable until reviewed_by_employee = true 

- ☐  Match results expose only Match Score and Gap Analysis — never raw candidate data 

### **Core Demo Path** 

- ☐  Pillar 1: intake conversation completes and Skill Radar renders 

- ☐  Pillar 2: at least one sandbox challenge grades correctly and awards a badge live 

- ☐  Pillar 3: a saved Role Skill Template correctly fires a live notification 

- ☐  Pillar 3b: Continuity Brief and custom challenge are visible for the demo transition posting 

- ☐  Payment: Upgrade flow completes (real Telebirr sandbox or styled mock) and Admin counters tick up 

### **Insurance** 

- ☐  Admin "seed demo data" button tested at least 3 times against the final schema 

- ☐  30-second backup video of the AI coach flow recorded and playable offline 

- ☐  Team has rehearsed continuing the demo narration over seeded data if a live AI call fails 

### **Pitch** 

- ☐  60-second elevator pitch rehearsed by every teammate 

- ☐  2–3 minute technical deep-dive rehearsed by at least one teammate per major section (schema/RLS, AI orchestration, payments) 

- ☐  Every teammate can explain at least one pillar they didn't personally build 

_End of document. Build in the order above, protect the demo with the admin fallback, and keep the security boundaries non-negotiable even when the clock is against you._ 

