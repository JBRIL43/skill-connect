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
        check("no awaiting-approval state is rendered for a state that cannot exist",
              "Awaiting approval" not in html)
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
