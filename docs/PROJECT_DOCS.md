# **Skill-Connect Ethiopia — Project Documentation & Hackathon Playbook**

**Event:** Cursor AI Hackathon Ethiopia — July 2026 **Venue:** Adwa Victory Memorial Park, Addis Ababa **Tagline:** *The Human Capability Acceleration Engine for the AI Era*

---

## **0\. How to Use This Document**

This is your single source of truth for the next 48 hours. It answers three questions at every stage: **what are we building, in what order, and who does what.** If a decision isn't in here, make the simplest choice that keeps the demo working — don't gold-plate.

Print or pin the **Section 10 Hour-by-Hour Plan** — that's the one you'll actually look at every few hours.

---

## **0.5 Do This Before You Write Any Code**

Ethio Telecom is judging, may extend internship/hire offers to standout participants, and can grant you a demo Telebirr API. Investors will also walk the floor. None of this costs build time if you handle it now:

1. **Register at [developer.ethiotelecom.et](https://developer.ethiotelecom.et)** — use the **same email address you registered with on Luma**. Do this tonight, not tomorrow morning; account approval may take time.  
2. Once registered, request **demo/sandbox Telebirr API credentials** — this is what upgrades your payment flow from a mock to a real (sandbox) integration, which is exactly what Ethio Telecom's judges will want to see.  
3. Assign **one teammate** to own this relationship: check email/dashboard for credential approval periodically through Day 1, so integration isn't blocked waiting on someone.  
4. Prep a **60-second elevator pitch** and a **2-minute technical deep-dive** (Section 12\) — you will give both multiple times, informally, to people who just walk up.

---

## **1\. Executive Summary & Core Philosophy**

Skill-Connect Ethiopia is an AI-powered workforce infrastructure platform that prepares Ethiopian youth for an AI-driven job market. It goes beyond job matching — it's a personal AI career coach that surfaces latent human talent, builds interactive learning roadmaps, verifies real ability through scored practice, and connects capability-verified talent directly with Small and Medium Enterprises (SMEs).

**The Problem:** AI is automating entry-level roles faster than curricula can adapt. Students are learning outdated skills and feel anxious about their futures. Local SMEs want to adopt AI but can't find fluent, verified talent — resumes and self-reported skills don't tell them who can actually do the job — and every time an experienced employee leaves, that SME loses know-how it never wrote down.

**Our Philosophy ("Co-Intelligence"):** AI will not replace Ethiopian youth. A human walking *with* AI will replace a human working alone. Skill-Connect helps young people thrive by treating AI as a capability multiplier — one that trains them, scores them honestly, and helps SMEs keep growing even as their teams change, always keeping a human at the center of that growth.

**Why this wins a hackathon:** judges reward (1) a sharp, local, well-defined problem, (2) a working end-to-end demo — not slides, (3) visible AI orchestration (they're judging *Cursor* usage too), (4) a believable path to revenue, (5) real local-infrastructure integration, and (6) a mechanism that's actually defensible on privacy and security grounds. Sections 7, 9, 12, and 13 are built specifically to hit all six.

---

## **2\. The Core Mechanism — How Matching Actually Works**

This is the engine behind every pillar below. Understand this section and you can explain the whole product in one breath.

1. **Sandbox challenges produce a real, graded score — not a self-report.** Every challenge a job-seeker completes in the Sandbox (Pillar 2\) is evaluated by AI against a rubric, producing a numeric **Sandbox Score** per competency (e.g. *"Prompt Engineering: 82/100, Task Accuracy: 74/100, Communication: 88/100"*). This is what makes the platform credible to companies: verified performance, not a resume claim.  
2. **Companies define reusable Role Skill Templates**, not one-off job posts. An SME builds a checklist once — *"Retail Inventory Assistant needs: Excel basics ≥70, AI prompt literacy ≥75, customer comms ≥65"* — and saves it. Any candidate whose Sandbox Scores clear that bar becomes eligible for *any* future opening that reuses the template, not just a single posting.  
3. **Notifications are template-triggered, not a surveillance feed.** When a candidate's score crosses a saved template's threshold, the SME is notified: *"3 candidates now qualify for your Inventory Assistant template."* Companies only ever see activity tied to a template they explicitly built (see Section 9 for why this matters for privacy).  
4. **A resigning employee's handover becomes a real, custom sandbox challenge.** Instead of only producing a text brief, the AI turns the outgoing employee's described day-to-day into an actual scored challenge — reusing the same challenge-generation logic Pillar 2 already needs, fed with real job content instead of a generic template. Incoming candidates get scored against *that specific job*, not a generic rubric. The same challenge can be reused in "training mode" once someone's hired, doubling as onboarding practice.  
5. **Optional "Workplace Pressure Simulation."** Certain sandbox challenges can be run with a strict, demanding AI "manager" persona — tight deadlines, blunt feedback on the *work*, ambiguous asks, the way a real first week can feel. This is opt-in, never default, and is bounded by the rule in Section 9: the AI is critical of output, never demeaning of the person, with a visible toggle back to supportive coaching mode at any time.

---

## **3\. Product Architecture — Four Pillars**

### **Pillar 1: AI Talent Discovery Coach (Job-Seeker View)**

Conversational AI career coach (text, voice optional) that replaces static multiple-choice assessments — and doubles as the platform's general assistant (see box below).

* Situational intake interview in **Amharic or English**, understood as **plain natural conversation**, not rigid multiple choice  
* Surfaces latent human skills (adaptability, problem-solving, empathy) alongside technical/AI skills  
* Parses conversation into a structured JSON skill matrix in real time  
* Renders a live animated **"Skill Radar"** chart  
* Recommends 2–3 AI-resilient career paths, with the specific courses/challenges in the Sandbox that will get their CV and scores ready for that path

> **One engine, two jobs:** the same conversational AI model and prompt-handling logic that powers the intake interview also powers a small **"Ask Skill-Connect"** help bubble available site-wide — a plain-English chatbot a user or SME can ask things like *"how does matching work?"* or *"how do I post a transition role?"* Reusing the same engine keeps this from becoming a second build.

### **Pillar 2: The "Walk-With-AI" Sandbox (Learning \+ Scoring View)**

Interactive learning roadmap that both teaches and **certifies**, not a static course list.

* Node-tree UI (built with `@xyflow/react`) generated dynamically from the user's skill matrix and, where relevant, target role  
* Each node \= a localized Ethiopian business micro-challenge (e.g., "Help a Merkato textile shop write a WhatsApp catalog with AI"), graded by AI against a visible rubric on completion  
* User solves it *with* an embedded AI assistant — they learn to direct and prompt, not to code  
* Completing a node issues a **verified capability badge \+ Sandbox Score**, both stored on the profile  
* Some nodes can be run in **Workplace Pressure Simulation** mode (Section 2, point 5\) for candidates who want to practice under real deadline pressure before an actual interview

### **Pillar 3: SME Talent Matcher \+ Company Profiles (Employer View)**

* **Company Profiles:** every SME gets a public profile page — logo, industry, size, a short "AI-adoption journey" blurb, and a track record of roles filled through the platform.  
* **Role Skill Templates (Section 2, point 2):** SMEs build a reusable scoring checklist per role type instead of writing a fresh job post every time.  
* SMEs can also just type a plain-language problem — *"I need someone to automate my retail inventory"* — and the system proposes a template automatically via semantic search (pgvector) against candidate skill matrices and scores.  
* Returns a ranked list with a **Match Score (0–100%)** and a **Gap Analysis** ("candidate is strong in prompt engineering, would need onboarding in inventory tools")  
* **Notifications** fire automatically when new candidates clear a saved template's thresholds  
* **1-click shortlist/hire action**

### **Pillar 3b: Institutional Handover Mode**

When an employee resigns, there's normally a scramble and lost knowledge. Skill-Connect turns that transition into a structured, AI-assisted, *scored* handover:

1. SME flags a posting as a **Transition Role**.  
2. If willing, the outgoing employee goes through a short **AI Handover Interview** — reusing the Pillar 1 engine — describing recurring tasks, tools, shortcuts, and who they coordinate with. They get a chance to **review and redact** the result before anything is saved (no client names or internals leak by accident).  
3. The AI produces two things: a readable **Continuity Brief** for onboarding, and a **custom Sandbox challenge** modeled on that specific job (Section 2, point 4).  
4. Incoming candidates are scored against that real challenge, so matching reflects *this exact departure*, not a generic rubric.  
5. Once hired, the new employee gets the Continuity Brief plus the same challenge in "training mode" for onboarding practice.

**Why it's worth the scope:** it reuses Pillar 1's engine and Pillar 2's challenge-scoring logic almost as-is (Section 8), so the build cost is small, but it's the strongest answer to "how does this help real companies, not just individuals" — exactly what a technical judge will ask.

### **Pillar 4: Admin Console**

A judge-visible surface most hackathon teams skip — and it doubles as your live-demo insurance policy (details in Section 4).

---

## **4\. User Roles & Access**

| Role | How they sign up | What they see |
| ----- | ----- | ----- |
| `job_seeker` | Self-serve signup (email or phone) | Pillars 1 & 2, their own profile/badges/scores |
| `sme` | Self-serve signup, marked `pending_verification` initially | Pillar 3, their company profile, their templates, their postings |
| `admin` | **Not self-serve.** Seeded directly in Supabase via SQL, or promoted through a protected `/admin/promote` route gated by a hardcoded invite code (hackathon-only shortcut) | Pillar 4 — full platform view |

### **Admin access — exact steps**

1. In Supabase Studio → Table Editor → `profiles`, manually set one seed user's `role` to `admin`. Fastest, most reliable method for a 48-hour build.  
2. Admin logs in through the same `/login` page as everyone else. The app checks `role` after auth and routes `admin` users to `/admin` instead of `/dashboard`.  
3. Admin console shows:  
   * Total job seekers, SMEs, postings, matches made, transition roles in progress (live counters, good visual for judges)  
   * A searchable table of all skill matrices and sandbox scores (for live debugging/demo recovery)  
   * A "seed demo data" button that re-populates realistic Addis Ababa test profiles, company profiles, and pre-scored candidates in one click — **this is your safety net if live AI calls fail during judging**  
   * Simple approve/reject toggle for SME verification (`pending_verification` → `verified`)

---

## **5\. What's In It for Companies — the Free Hook**

The paid matching flow only works once SMEs already trust you. So the funnel starts free, before any hiring ask:

1. **Free "AI Readiness Snapshot":** a 5-question form or 2-minute chat (same engine as Pillar 1\) that returns an instant, specific report — *"Here are 3 tasks in your business an AI-fluent hire could take off your plate this month."* Costs almost nothing to build, positions you as a free consultant, not a job board.  
2. **Free Continuity Brief on resignation, no posting required.** *"Someone just quit? Capture their knowledge in a 10-minute AI interview, free."* This is an acute, immediate pain, not a someday-maybe need — it gets SMEs into the system at their moment of highest urgency. The natural next step is "now let AI find your replacement," which is where paid matching begins.  
3. **Company Profile as a status symbol:** verified SMEs get a shareable "AI-Forward Business" badge they can post to their own Telegram/Facebook page — a vanity hook that costs nothing and spreads the platform for free.

**Suggested SME funnel order:** Free Readiness Snapshot → Free Handover Brief (if/when needed) → Role Skill Template \+ paid matching once they're already relying on you → Verified Company Profile badge as the retention/status layer.

---

## **6\. Monetization Model (Investor/Judge Slide)**

| Stream | Model | Notes |
| ----- | ----- | ----- |
| **B2B (Primary)** | SMEs pay a subscription or per-hire fee to access AI-matched, verified talent once they've used the free hooks in Section 5 | Bypasses traditional recruiters; core revenue driver |
| **B2B (Add-on)** | Premium tier for saved Role Skill Templates \+ auto-notifications, and priority Institutional Handover | Natural upsell tied to something SMEs already need |
| **B2G & Universities** | Institutional dashboards for MinT (Ministry of Innovation & Technology) and universities tracking regional digital-skill uptake | Aggregate, anonymized data only |
| **B2C (Freemium)** | Free: AI assessment, roadmap, and basic Sandbox scoring. Paid: mock interviews under Workplace Pressure Simulation, verified premium badges | Keeps youth access free — good for the "impact" narrative judges like |

### **Payment Method — What to actually build in 48 hours**

Because Ethio Telecom is judging and has offered a demo API, **Telebirr becomes your primary named rail**, with Chapa as a secondary/backup story:

1. **Follow Section 0.5** — register at developer.ethiotelecom.et with your Luma email, request sandbox Telebirr credentials as early as possible on Day 1\.  
2. **If credentials arrive in time:** wire a real **Telebirr sandbox checkout** for the SME "Upgrade" flow. This is the single highest-value technical flex for the Ethio Telecom judges specifically.  
3. **If credentials don't arrive in time (have this ready regardless):** fall back to a **mocked checkout UI** styled after Telebirr's real flow. Mention **Chapa** in the pitch as the multi-rail backup for cards/other mobile-money providers.  
4. Say explicitly in the pitch what's real vs. mocked. Judges respect honesty about scope far more than a shaky live demo.

---

## **7\. Technology Stack**

* **Frontend:**Typescript, Next.js 15 (App Router), Tailwind CSS, Shadcn UI, Framer Motion (polish pass only)  
* **Backend/DB:** Supabase — PostgreSQL for structured data, `pgvector` extension for semantic SME↔talent matching, **Row Level Security (RLS)** enforced on every sensitive table (Section 9\)  
* **AI Orchestration:** Vercel AI SDK (streams AI responses directly into React components)  
* **LLM Provider:** OpenAI or Gemini API for conversational intake, handover interviews, sandbox challenge grading, and matching logic  
* **Voice (optional stretch):** ElevenLabs or Whisper for Amharic/English voice interaction — only attempt this in Phase 4 if core flows are solid  
* **Visualization:** `@xyflow/react` for the learning roadmap node tree; Recharts or a custom SVG for the Skill Radar  
* **Payments:** Telebirr sandbox API (primary, via Ethio Telecom developer portal), Chapa (backup/multi-rail narrative)

---

## **8\. Data Schema (Supabase / PostgreSQL)**

\-- profiles  
id              UUID PRIMARY KEY  
role            ENUM ('job\_seeker', 'sme', 'admin')  
full\_name       TEXT  
bio             TEXT  
phone           TEXT  
region          TEXT  
created\_at      TIMESTAMP

\-- company\_profiles  (one per SME)  
id              UUID PRIMARY KEY  
sme\_id          UUID REFERENCES profiles(id)  
company\_name    TEXT  
industry        TEXT  
size            TEXT  
logo\_url        TEXT  
about           TEXT  
verified        BOOLEAN DEFAULT FALSE

\-- skill\_matrices  
id              UUID PRIMARY KEY  
user\_id         UUID REFERENCES profiles(id)  
skills\_json     JSONB  
readiness\_score INTEGER  
created\_at      TIMESTAMP

\-- sandbox\_scores  (new — one row per completed challenge)  
id              UUID PRIMARY KEY  
user\_id         UUID REFERENCES profiles(id)  
node\_id         TEXT              \-- which sandbox challenge was completed  
scores\_json     JSONB             \-- {"ai\_prompt\_literacy": 82, "task\_accuracy": 74, "customer\_comms": 88}  
                                  \-- NOTE: this brief gives two different score vocabularies — the one
                                  \-- shown here and the excel\_basics / ai\_prompt\_literacy / customer\_comms
                                  \-- of the Role Skill Template below. Matching compares the two blobs key
                                  \-- by key, so they have to be one list. lib/sandbox/competencies.ts is
                                  \-- that list and overrides this document. Keys shown above updated to it.  
mode            ENUM ('standard', 'pressure\_simulation')  
completed\_at    TIMESTAMP

\-- badges  
id              UUID PRIMARY KEY  
user\_id         UUID REFERENCES profiles(id)  
node\_id         TEXT  
badge\_name      TEXT  
awarded\_at      TIMESTAMP

\-- role\_skill\_templates  (new — reusable SME scoring checklists)  
id              UUID PRIMARY KEY  
sme\_id          UUID REFERENCES profiles(id)  
role\_name       TEXT  
thresholds\_json JSONB             \-- {"excel\_basics": 70, "ai\_prompt\_literacy": 75, "customer\_comms": 65}  
notify\_on\_match BOOLEAN DEFAULT TRUE  
created\_at      TIMESTAMP

\-- sme\_postings  
id                 UUID PRIMARY KEY  
sme\_id             UUID REFERENCES profiles(id)  
template\_id        UUID REFERENCES role\_skill\_templates(id)  \-- new: links posting to a reusable template  
description        TEXT  
is\_transition\_role BOOLEAN DEFAULT FALSE  
status             ENUM ('open', 'filled')  
created\_at         TIMESTAMP

\-- continuity\_briefs  (only exists for transition roles)  
id                 UUID PRIMARY KEY  
posting\_id         UUID REFERENCES sme\_postings(id)  
raw\_interview\_json JSONB  
generated\_brief    TEXT  
custom\_node\_id     TEXT           \-- new: the AI-generated sandbox challenge modeled on this job  
reviewed\_by\_employee BOOLEAN DEFAULT FALSE  \-- new: redaction/consent gate before it's usable  
created\_at         TIMESTAMP

\-- matches  
id              UUID PRIMARY KEY  
posting\_id      UUID REFERENCES sme\_postings(id)  
candidate\_id    UUID REFERENCES profiles(id)  
match\_score     INTEGER  
gap\_analysis    TEXT  
status          ENUM ('suggested', 'shortlisted', 'hired')

\-- notifications  (new — template-triggered, not a general feed)  
id              UUID PRIMARY KEY  
sme\_id          UUID REFERENCES profiles(id)  
template\_id     UUID REFERENCES role\_skill\_templates(id)  
candidate\_id    UUID REFERENCES profiles(id)  
seen            BOOLEAN DEFAULT FALSE  
created\_at      TIMESTAMP

\-- payments  
id              UUID PRIMARY KEY  
sme\_id          UUID REFERENCES profiles(id)  
provider        ENUM ('telebirr', 'chapa', 'mock')  
amount          INTEGER  
status          ENUM ('pending', 'paid')  
created\_at      TIMESTAMP

Keep every table this flat. Do not add extra normalization tables under time pressure — Cursor's Composer works faster and more reliably against a small, obvious schema.

---

## **9\. Trust & Security Model (Do Not Skip This)**

The matching mechanism in Section 2 is powerful precisely because it's built on real scores — which is exactly why it needs real boundaries. Treat these as hard rules, not stretch goals:

1. **Companies never see raw conversation transcripts.** A candidate's intake chat or handover interview may surface personal context (family situation, disability, reason for job-hunting). SMEs only ever see *derived* outputs: Sandbox Scores, badges, and Gap Analysis text. This is enforced in the query layer, not just hidden in the UI.  
2. **Opt-in discoverability, not scraping.** A candidate must toggle "open to being matched" before their scores count toward any SME's Role Skill Template results — the same pattern as LinkedIn's "open to work." Without this, the platform becomes passive surveillance of job seekers who never agreed to be evaluated by a specific employer.  
3. **Notifications are template-scoped.** An SME is only notified about candidates who clear a template *they* built and *the candidate* opted into — never a general "here's everyone's scores" feed.  
4. **Continuity Briefs are private to the issuing SME**, never public, and require the outgoing employee's review/redaction before they're usable — they may unintentionally include client names or internal specifics.  
5. **Workplace Pressure Simulation is bounded.** The AI "strict manager" persona stays critical of the *work product*, never of the *person* — no personal insults, no discouragement tied to identity. A visible toggle back to supportive coaching mode is always available. This applies to Claude/LLM prompt design directly: the system prompt for this mode must explicitly encode this boundary.  
6. **Enforced with Supabase Row Level Security (RLS), not just app logic:** job seekers can only query their own matrix/scores; SMEs can only query derived scores for candidates who opted into their specific template; admin access is scoped and logged. This is also a strong, concrete technical talking point for Ethio Telecom's judges — RLS policies are the kind of defensible architecture decision that shows real engineering judgment, not AI-generated boilerplate.

---

## **10\. Step-by-Step Feature List (Build Order)**

Build in this exact order. Each feature is demoable on its own, so if you run out of time you still have a working story.

1. **Auth \+ role routing** — signup/login, `job_seeker` vs `sme` vs `admin` redirect, RLS policies scaffolded from the start (Section 9\)  
2. **Job-seeker intake chat** — streaming AI conversation → structured skill JSON saved to DB  
3. **Skill Radar visualization** — renders from `skills_json`  
4. **Career recommendations** — 2–3 AI-resilient roles suggested from the matrix, linked to specific Sandbox nodes  
5. **Learning Sandbox node tree \+ scoring** — generated from matrix, at least 3 real localized challenges, each AI-graded into `sandbox_scores` on completion  
6. **Badge award on challenge completion**  
7. **SME signup \+ Company Profile page**  
8. **Free "AI Readiness Snapshot"** (Section 5\) — no signup friction, immediate value  
9. **Role Skill Templates** — SME builds a reusable threshold checklist per role  
10. **Semantic \+ threshold match engine** — posting/template → ranked candidate list with Match Score \+ Gap Analysis, respecting opt-in (Section 9\)  
11. **Notifications** — fire when a candidate clears a saved template  
12. **1-click shortlist/hire action**  
13. **Institutional Handover flow** — free AI interview for outgoing employee → Continuity Brief \+ AI-generated custom sandbox challenge, with employee review/redaction step  
14. **Payment flow** — Telebirr sandbox if credentials are ready, otherwise Telebirr-styled mock (Section 6\)  
15. **Admin console** — live counters, seed-data button, SME verification toggle  
16. **Site-wide "Ask Skill-Connect" chatbot bubble** — thin UI wrapper over the Pillar 1 engine  
17. **Optional: Workplace Pressure Simulation toggle** on select sandbox nodes, with the bounded system prompt from Section 9  
18. **Polish pass** — dark mode, Framer Motion transitions, seeded Addis Ababa test data, Amharic labels where feasible

---

## **11\. Where the Demo Data Comes From**

You cannot rely on real user sign-ups by tomorrow, and you should never use real people's names, photos, or company identities without consent. Practice and demo data should be **entirely synthetic, prepared in advance**, not generated live on stage:

1. **Generate personas ahead of time with the LLM itself.** Spend 15–20 minutes prompting your LLM provider directly (outside the app) for \~20 realistic Ethiopian job-seeker personas — name, background, short story — across sectors like retail, textiles, logistics, and agritech. Save as a static JSON seed file, and pre-assign each one plausible `sandbox_scores`.  
2. **Do the same for SMEs**: 8–10 fictional company profiles modeled on common Addis Ababa small-business sectors, each with at least one saved Role Skill Template. Use invented company names — never real, identifiable businesses (and never Ethio Telecom's name/brand for fictional demo data).  
3. **Ground it in real context, not real records.** You can reference general, publicly known facts about Ethiopia's labor market and youth unemployment trends to make personas believable — don't fabricate specific statistics and present them as sourced data in the pitch.  
4. **Load this static seed file via the Admin Console's "seed demo data" button** so rehearsal and stage always get the same reliable dataset in one click.  
5. **Practice on this exact seed data** for at least your last 10 rehearsal runs, so the live conversational parts (Pillar 1 intake, the SME query, the notification firing) are ones you've typed before and know the expected output for.

---

## **13\. The 2-Minute Demo Script**

Judges remember narratives, not feature lists. Run it in this order:

1. **(10s) The hook:** "Meet Selam, a university grad in Addis. She's anxious — she doesn't know if her skills matter in an AI economy." Open the app as a fresh job-seeker.  
2. **(25s) Pillar 1 live:** Short real conversation with the AI coach (pre-planned answers). Skill Radar animates in.  
3. **(25s) Pillar 2 live:** Solve one sandbox challenge with the embedded AI — show the graded score appear, badge pops.  
4. **(20s) Free hook, SME side:** Switch to an SME account, run the free AI Readiness Snapshot in a few seconds — "here's what AI could take off your plate."  
5. **(25s) Pillar 3 live:** Show the Company Profile, then the SME's saved Role Skill Template — a notification fires live showing Selam just qualified.  
6. **(15s) Pillar 3b:** "This posting is actually a transition role — someone resigned last week." Show the AI-generated Continuity Brief and the custom sandbox challenge modeled on that exact job.  
7. **(10s) Payment \+ Admin:** SME clicks "Upgrade" → Telebirr checkout → Admin console's live counters tick up.  
8. **(10s) Close:** One sentence on the business model (Section 6\) and the local-first thesis: *"Built for Ethiopia's SMEs and youth, in Amharic, on a payment rail Ethiopians already trust — and scored, not guessed."*

**Fallback rule:** if any live AI call is slow or fails during judging, hit the admin "seed demo data" button and continue narrating over pre-seeded data without breaking stride. Rehearse this fallback too.

---

## **14\. Judges & Investor Engagement (Read This Before the Floor Opens)**

Ethio Telecom judges will focus on **technical depth**, and standout participants may be shortlisted for internships or hiring conversations. Investors and other organizations will also walk the floor throughout the event. Treat both as first-class parts of the hackathon, not a distraction from coding:

* **Everyone on the team should be able to explain the architecture**, not just one person. Take 10 minutes in the polish phase to walk each other through the parts you didn't personally build — especially the RLS/security model in Section 9, since it's a strong, specific thing to discuss.  
* **Have two pitches ready:**  
  * A **60-second elevator pitch** (hook \+ problem \+ the four pillars in one sentence each) for anyone who casually stops by.  
  * A **2–3 minute technical deep-dive** for Ethio Telecom specifically: open Cursor and show the Vercel AI SDK streaming route, the pgvector match query, the RLS policies, and the Telebirr integration code directly.  
* **Actively look for a natural moment to mention Telebirr integration** to any Ethio Telecom representative who visits.  
* **Don't oversell what's mocked.** Say plainly what's live versus mocked. This is a strength in front of technical judges, not a weakness.  
* Assign **one teammate as the designated first responder** when someone new walks up, but rotate who gives the technical walkthrough so every teammate gets facetime.

---

## **15\. What Makes Judges Say "This One's Different"**

* **Verified, not self-reported.** Sandbox Scores turn "I know AI tools" into a graded number a company can trust — this is the single strongest technical/product differentiator in the whole project.  
* **Localization is real, not decorative** — Amharic intake, Addis Ababa test data, and (if credentials arrive) a live Telebirr sandbox integration.  
* **You show AI orchestration, not just AI output** — the Sandbox literally teaches and grades "directing AI," mirroring what the hackathon itself is testing.  
* **Institutional Handover Mode** tells judges you thought about a real, unglamorous business problem instead of only the flashy parts.  
* **A real security model (Section 9\)**, not an afterthought — opt-in matching, scoped notifications, RLS enforcement. This is rare in hackathon projects and will stand out specifically to technical judges.  
* **A monetization story with three real, distinct buyers**, a free-to-paid SME funnel (Section 5), and a natural upsell — most hackathon projects only have one revenue idea.  
* **Honesty about scope** reads as senior engineering judgment, not a weakness.

---

## **16\. Risk Register — Plan for These Before They Happen**

| Risk | Mitigation |
| ----- | ----- |
| LLM API rate-limited or slow during judging | Admin "seed demo data" button; pre-recorded 30s backup clip of the AI coach flow on a phone |
| Telebirr sandbox credentials don't arrive in time | Ready-made Telebirr-styled mock checkout (Section 6\) as a same-day fallback |
| Venue WiFi fails | Test the app on mobile hotspot the night before; confirm Supabase and your LLM provider are reachable over it |
| Semantic/threshold match returns nonsense on stage | Pre-test the exact SME query and template you'll demo live, at least 5 times beforehand |
| RLS misconfigured, exposing candidate data across roles | Test explicitly as both a `job_seeker` and `sme` account before demo freeze — this is a security bug, not just a display bug |
| Workplace Pressure Simulation reads as mean rather than "tough but fair" | Keep it opt-in, test the tone yourself first, cut it from the demo entirely if it doesn't land right in rehearsal |
| Amharic text rendering breaks on a judge's browser | Confirm font stack includes a Unicode Ethiopic-script font (e.g., Noto Sans Ethiopic) and test on the actual demo machine |
| Running out of time before Pillar 3b or payments | Section 10's build order is deliberate — Pillars 1, 2, and core Pillar 3 alone are still a coherent, demoable story |

---

## **17\. Suggested Team Split (adjust to your team size)**

* **1 person:** Supabase schema, auth, RLS policies, admin console  
* **1–2 people:** Pillar 1 (AI coach \+ Skill Radar) \+ site-wide chatbot bubble  
* **1–2 people:** Pillar 2 (Sandbox node tree \+ AI grading \+ challenges)  
* **1 person:** Pillar 3 (Company Profiles \+ Role Skill Templates \+ matching \+ notifications) \+ Pillar 3b (Handover flow) \+ Telebirr integration  
* **Everyone, last 4 hours:** seed data, polish, demo rehearsal, and make sure every teammate can explain at least one other person's part of the stack for the judges

---

*End of document. Good luck — build in the order above, protect your demo with the admin fallback, register on the Ethio Telecom developer portal tonight, take the security model in Section 9 seriously, and don't touch real financial infrastructure beyond the sandbox you're given.*

