#!/usr/bin/env python3
"""Drives the app with NEXT_PUBLIC_DATA_SOURCE=mock and no network at all.

Mock mode is the Risk Register's mitigation for a dead network or an unapplied
migration on demo day, which makes it the one path that has to work when
everything else does not — and, until now, the only path nothing tested.

It is also where the two adapters are easiest to drift apart, because mock
reimplements in TypeScript what Postgres does in SQL: 0006's label triggers and
the reviewed-brief filter both exist twice. This asserts they agree.

Start the app first:

    NEXT_PUBLIC_DATA_SOURCE=mock npm run dev

then run: npm run verify:mock
"""
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("VERIFY_BASE_URL", "http://localhost:3000").rstrip("/")
COOKIE = "sc_demo_profile"

# Fixture ids from lib/data/mock/fixtures.ts.
SME_KALITI = "sme-kaliti"          # owns the transition posting and its brief
SME_BOLE = "sme-bole"              # owns the inventory posting
JS_DAWIT = "js-dawit"              # a candidate, owns neither
POST_INVENTORY = "post-inventory"
POST_DISPATCH = "post-dispatch"
TRANSITION_NODE = f"transition-{POST_DISPATCH}"

# The first prompt in lib/handover/interview.ts, used as a marker for "this
# person is looking at the interview screen".
FIRST_QUESTION = "What would you call this job?"

# A plausible handover, typed the way the outgoing employee would type it.
# The wholesaler is the client name that has to survive into the draft and then
# be cut at the redaction step -- that round trip is the point of the gate.
ANSWERS = {
    "role_title": "Dispatch Coordinator",
    "recurring_tasks": "\n".join([
        "Reconcile the farm delivery against yesterday orders before 5:30am",
        "Allocate two vans across ten customers before the 6am loading",
        "Chase the late farm delivery when the truck misses its slot",
    ]),
    "tools": "WhatsApp\nA shared order spreadsheet",
    "shortcuts": "\n".join([
        "The Bole Rd wholesaler always short-ships onions, so count them twice",
        "Load the furthest hotel last or it arrives warm",
    ]),
    "coordinates_with": "Two drivers\nThe cooperative farm liaison",
    "notes": "The morning cycle is the whole job. Everything else can wait.",
}

passes = 0
failures: list[str] = []


def check(label, ok, detail=""):
    global passes
    if ok:
        passes += 1
        print(f"  PASS  {label}")
    else:
        failures.append(label)
        print(f"  FAIL  {label}" + (f"\n          {detail}" if detail else ""))


def app(method, path, profile=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    if profile:
        req.add_header("Cookie", f"{COOKIE}={profile}")
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.status, res.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:  # noqa: BLE001
        return -1, str(e)


def op(profile, **body):
    status, raw = app("POST", "/api/verify-flows", profile=profile, body=body)
    try:
        return status, json.loads(raw)
    except Exception:  # noqa: BLE001
        return status, raw


def main() -> int:
    print(f"Mock flows against {BASE}\n")

    status, html = app("GET", "/matcher", profile=SME_BOLE)
    if status != 200:
        print(f"  the app is not answering on {BASE} ({status}).")
        print("  start it with: NEXT_PUBLIC_DATA_SOURCE=mock npm run dev")
        return 1
    check("the app serves the matcher hub in mock mode", status == 200)
    if "Sign in" in html[:2000]:
        print("\n  This looks like supabase mode. Mock mode is what this suite tests.")
        return 1

    # ------------------------------------------------------------------ match
    print("\nPillar 3 — matching in the offline fallback")
    status, res = op(SME_BOLE, op="match", postingId=POST_INVENTORY)
    check("match run completes", status == 200, f"status {status}: {str(res)[:200]}")
    matched = res.get("matched", 0) if isinstance(res, dict) else 0
    check("the run produced at least one ranked candidate", matched >= 1,
          f"matched {matched}")

    status, seen = op(SME_BOLE, op="mock:inspect", postingId=POST_INVENTORY)
    check("inspection succeeded", status == 200, f"status {status}: {str(seen)[:200]}")

    # -------------------------------------------------------------- pgvector
    print("\nPhase 6 — vectors persist through the mock adapter too")
    check("the posting carries a 1536-dimension role vector",
          seen.get("postingDimensions") == 1536,
          f"got {seen.get('postingDimensions')}")

    matrices = seen.get("matrices", [])
    stored = [m for m in matrices if m.get("dimensions") == 1536]
    # A candidate with no skill_matrices row is skipped, never created: the
    # matrix belongs to Pillar 1. So None is a valid outcome, and any other
    # width is not.
    check("no matched candidate got a wrongly sized vector",
          all(m["dimensions"] in (None, 1536) for m in matrices),
          f"{[m.get('dimensions') for m in matrices]}")
    check("at least one matched candidate had their vector stored",
          bool(stored),
          "every candidate was skipped, so the write path is untested — "
          "does any fixture candidate have both scores and a skill matrix?")

    # ---------------------------------------------------------------- labels
    print("\n0006's label rules are mirrored, not reinvented")
    rows = seen.get("matches", [])
    check("every match carries a display label",
          bool(rows) and all(r.get("candidate_label") for r in rows))
    named = [r for r in rows if r["candidate_label"] != r["anonymous_label"]]
    check("an opted-in candidate is shown by name", bool(named),
          "every row fell back to the anonymous label")
    check("the anonymous label is a stable letter",
          all(str(r.get("anonymous_label", "")).startswith("Candidate ") for r in rows),
          f"{[r.get('anonymous_label') for r in rows]}")

    if named:
        victim = named[0]["candidate_id"]
        was = named[0]["candidate_label"]
        op(SME_BOLE, op="mock:set-optin", userId=victim, value=False)
        _, after = op(SME_BOLE, op="mock:inspect", postingId=POST_INVENTORY)
        row = next(r for r in after["matches"] if r["candidate_id"] == victim)
        check("opting out takes the name back from a company that already matched",
              row["candidate_label"] == row["anonymous_label"],
              f"still showing {row['candidate_label']}")

        op(SME_BOLE, op="mock:set-optin", userId=victim, value=True)
        _, back = op(SME_BOLE, op="mock:inspect", postingId=POST_INVENTORY)
        row = next(r for r in back["matches"] if r["candidate_id"] == victim)
        check("opting back in restores the name", row["candidate_label"] == was,
              f"got {row['candidate_label']}")

    # ------------------------------------------------- unreviewed brief (506)
    print("\nAn unreviewed brief is unreachable in the fallback as well")
    status, html = app("GET", f"/matcher/postings/{POST_DISPATCH}", profile=SME_KALITI)
    check("the reviewed brief is visible to its owner",
          status == 200 and "Score candidates on this actual job" in html,
          f"status {status}")

    op(SME_KALITI, op="mock:set-brief-review", postingId=POST_DISPATCH, value=False)
    try:
        status, html = app("GET", f"/matcher/postings/{POST_DISPATCH}",
                           profile=SME_KALITI)
        check("the brief card disappears once unreviewed",
              status == 200 and "Score candidates on this actual job" not in html,
              f"status {status}")
        # Until Phase 6 this state was unreachable and nothing rendered for it.
        # Now that an interview can be recorded and left unapproved, the page
        # says so — but must name the state without quoting the brief.
        check("the posting reports that a brief is waiting on the employee",
              "Awaiting approval" in html)
        check("the brief's interview text does not leak into the page",
              "Confirm farm arrival quantities" not in html)

        status, res = op(SME_KALITI, op="handover", postingId=POST_DISPATCH)
        check("generating a challenge from an unreviewed brief is refused",
              status >= 400, f"status {status}: {str(res)[:200]}")
    finally:
        op(SME_KALITI, op="mock:set-brief-review", postingId=POST_DISPATCH, value=True)

    status, res = op(SME_KALITI, op="handover", postingId=POST_DISPATCH)
    check("it generates again once the brief is approved", status == 200,
          f"status {status}: {str(res)[:200]}")

    # -------------------------------------------- Pillar 3b, candidate side
    # The generated body has no table, so the store behind it is a per-process
    # memo. Clearing it is what a second instance, or a restart, looks like.
    print("\nA transition challenge survives the instance that generated it")
    status, res = op(SME_KALITI, op="mock:clear-generated")
    check("the generated-challenge memo can be emptied", status == 200,
          f"status {status}: {str(res)[:200]}")

    status, html = app("GET", "/sandbox", profile=JS_DAWIT)
    check("a candidate's node tree lists the transition challenge on a cold cache",
          status == 200 and TRANSITION_NODE in html,
          f"status {status}; deriving the tree from the memo is what breaks this")

    op(SME_KALITI, op="mock:clear-generated")
    status, html = app("GET", f"/sandbox/{TRANSITION_NODE}", profile=JS_DAWIT)
    check("a candidate can open it without the SME having just generated it",
          status == 200,
          f"status {status}; the brief is SME-scoped, so this 404s if the "
          "challenge is resolved through the owner-only read")
    # The reviewed interview's tasks and tools are meant to be here -- being
    # scored on the actual job is the Section 2 point 4 feature, and review is
    # the redaction step that makes it safe. What must not appear is anything
    # that only exists for the SME.
    check("the challenge is built from the real job, not a generic rubric",
          "Confirm farm arrival quantities" in html,
          "the generated body did not carry the real recurring tasks")
    check("the SME-facing continuity brief prose stays out of it",
          "then restaurants by delivery distance" not in html,
          "the brief itself was rendered, not the challenge derived from it")
    check("the internal review note stays out of it",
          "specific client contact names were removed" not in html)

    # ------------------------------------------- Pillar 3b, the interview
    # Everything above starts from the seeded brief. This starts from nothing,
    # which is what an SME with a departing employee actually has.
    print("\nPhase 6 — the handover interview, from no brief at all")
    _, dropped = op(SME_KALITI, op="mock:drop-brief", postingId=POST_DISPATCH)
    seeded = dropped.get("dropped") if isinstance(dropped, dict) else None
    check("the seeded brief can be cleared to reach the never-interviewed state",
          bool(seeded), str(dropped)[:200])

    try:
        status, html = app("GET", f"/matcher/postings/{POST_DISPATCH}",
                           profile=SME_KALITI)
        check("a transition posting with no brief offers the interview",
              status == 200 and "Start the handover interview" in html,
              f"status {status}")

        status, html = app("GET", f"/matcher/postings/{POST_INVENTORY}",
                           profile=SME_BOLE)
        check("a normal posting does not offer one",
              status == 200 and "Start the handover interview" not in html,
              f"status {status}")

        # urllib follows the redirect, so a refusal shows up as landing
        # somewhere without the interview on it rather than as a 3xx.
        status, other = app("GET", f"/handover/{POST_DISPATCH}", profile=SME_BOLE)
        check("another SME cannot open the interview screen",
              FIRST_QUESTION not in other, f"status {status}")

        status, res = op(SME_BOLE, op="interview", postingId=POST_DISPATCH,
                         answers={"role_title": "Dispatch",
                                  "recurring_tasks": "a\nb"})
        check("another SME cannot record one either", status >= 400,
              f"status {status}: {str(res)[:200]}")

        # Too thin to build a challenge from: a title and nothing else.
        status, res = op(SME_KALITI, op="interview", postingId=POST_DISPATCH,
                         answers={"role_title": "Dispatch Coordinator"})
        check("an interview with nothing in it is refused, with a reason",
              status == 422 and isinstance(res, dict) and res.get("gaps"),
              f"status {status}: {str(res)[:200]}")

        status, res = op(SME_KALITI, op="interview", postingId=POST_DISPATCH,
                         answers=ANSWERS)
        check("a real interview saves", status == 200,
              f"status {status}: {str(res)[:200]}")

        status, html = app("GET", f"/matcher/postings/{POST_DISPATCH}",
                           profile=SME_KALITI)
        check("saving does not approve: the posting shows it awaiting the employee",
              status == 200 and "Awaiting approval" in html, f"status {status}")
        check("and the employer cannot read it yet",
              "Score candidates on this actual job" not in html)
        check("nor can the unapproved prose reach the employer's page",
              "reconcile the farm delivery" not in html.lower())

        status, res = op(SME_KALITI, op="handover", postingId=POST_DISPATCH)
        check("a challenge cannot be built from it before approval", status >= 400,
              f"status {status}: {str(res)[:200]}")

        status, html = app("GET", f"/handover/{POST_DISPATCH}", profile=SME_KALITI)
        check("the employee's own screen does show it, to be redacted",
              status == 200 and "reconcile the farm delivery" in html.lower(),
              f"status {status}")
        check("the answers reload into the interview for editing",
              "Bole Rd wholesaler" in html)

        # What the employee actually does at the gate: cut the client name.
        redacted = ("The dispatch coordinator role reconciles the farm delivery "
                    "against the previous day orders before 5:30am and "
                    "allocates two vans across ten customers.")
        status, res = op(SME_KALITI, op="approve", postingId=POST_DISPATCH,
                         generatedBrief=redacted)
        check("approving works", status == 200, f"status {status}: {str(res)[:200]}")

        status, html = app("GET", f"/matcher/postings/{POST_DISPATCH}",
                           profile=SME_KALITI)
        check("the employer can now read the brief",
              status == 200 and "Score candidates on this actual job" in html,
              f"status {status}")
        check("and reads the redacted text, not the draft",
              redacted[:60] in html and "Bole Rd wholesaler" not in html,
              "the pre-redaction draft was served instead of the approved text")

        status, res = op(SME_KALITI, op="handover", postingId=POST_DISPATCH)
        check("the approved brief generates a challenge", status == 200,
              f"status {status}: {str(res)[:200]}")

        status, html = app("GET", f"/sandbox/{TRANSITION_NODE}", profile=JS_DAWIT)
        check("and a candidate is scored on the job that was described",
              status == 200 and "Chase the late farm delivery" in html,
              f"status {status}; the interview's tasks did not reach the challenge")

        # Editing after approval is the one way unreviewed text could ship under
        # an approved flag, so saving has to revoke approval.
        status, res = op(SME_KALITI, op="interview", postingId=POST_DISPATCH,
                         answers={**ANSWERS, "notes": "Added after approval."})
        check("re-running the interview on an approved brief saves", status == 200,
              f"status {status}: {str(res)[:200]}")
        status, html = app("GET", f"/matcher/postings/{POST_DISPATCH}",
                           profile=SME_KALITI)
        check("editing an approved brief sends it back behind the gate",
              status == 200 and "Awaiting approval" in html,
              "the edit kept the approved flag, so unreviewed text is now shared")
    finally:
        if seeded:
            op(SME_KALITI, op="mock:restore-brief", postingId=POST_DISPATCH,
               brief=seeded)

    # ------------------------------------------------------------- ownership
    print("\nOwnership holds without a database to enforce it")
    status, _ = op(SME_BOLE, op="handover", postingId=POST_DISPATCH)
    check("another SME cannot generate from a brief they do not own", status >= 400,
          f"status {status}")
    status, _ = op(SME_BOLE, op="match", postingId=POST_DISPATCH)
    check("another SME cannot run a match on a posting they do not own",
          status >= 400, f"status {status}")

    print("")
    total = passes + len(failures)
    if failures:
        print(f"{len(failures)} of {total} checks FAILED:")
        for f in failures:
            print("  -", f)
        return 1

    print(f"All {total} mock-mode checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
