#!/usr/bin/env python3
"""Drives the Dev 3 app flows against the live database as real signed-in users.

verify-live.py checks what the database permits. This checks what the app
actually does with a real session cookie on top of it: grading writes a score,
matching ranks candidates and notifies, and a reviewed brief becomes a scored
challenge. Anything that passes in mock mode but not here is a seam bug.

Assumes `next dev` is already listening on $BASE (default http://localhost:3000)
with NEXT_PUBLIC_DATA_SOURCE=supabase.
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:3000"


def load_env(path=".env.local"):
    env = {}
    for line in open(path):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


ENV = load_env()
URL = ENV["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
ANON = ENV["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
SERVICE = ENV["SUPABASE_SERVICE_ROLE_KEY"]
REF = ENV["SUPABASE_PROJECT_REF"]

failures = []
passes = 0


def check(label, ok, detail=""):
    global passes
    if ok:
        passes += 1
        print(f"  PASS  {label}")
    else:
        failures.append(label)
        print(f"  FAIL  {label}  {detail}")


def api(method, path, token=None, body=None, base=None, key=None):
    url = f"{base or URL}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", key or ANON)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            raw = res.read().decode()
            return res.status, (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw
    except Exception as e:
        return -1, str(e)


def rest(path, method="GET", body=None):
    """Service-role read, for asserting on what the app wrote."""
    return api(method, f"/rest/v1/{path}", token=SERVICE, key=SERVICE, body=body)


def set_password(user_id, password="Test1234!"):
    """Seed personas were created without a usable password."""
    return api("PUT", f"/auth/v1/admin/users/{user_id}", token=SERVICE, key=SERVICE,
               body={"password": password})


def sign_in(email, password="Test1234!"):
    status, res = api(
        "POST", "/auth/v1/token?grant_type=password",
        body={"email": email, "password": password},
    )
    if status != 200 or not isinstance(res, dict):
        raise SystemExit(f"could not sign in as {email}: {status} {res}")
    return res


def session_cookie(session):
    """Rebuild the cookie @supabase/ssr would have written for this session.

    Chunked at 3180 chars the same way the library does, otherwise a long JWT
    silently truncates and the server sees an anonymous request.
    """
    payload = {
        "access_token": session["access_token"],
        "refresh_token": session["refresh_token"],
        "expires_in": session.get("expires_in", 3600),
        "expires_at": session.get("expires_at"),
        "token_type": session.get("token_type", "bearer"),
        "user": session["user"],
    }
    encoded = "base64-" + base64.b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).decode()

    name = f"sb-{REF}-auth-token"
    if len(encoded) <= 3180:
        return {name: encoded}
    chunks = [encoded[i:i + 3180] for i in range(0, len(encoded), 3180)]
    return {f"{name}.{i}": c for i, c in enumerate(chunks)}


def app(method, path, cookies=None, body=None, form=None):
    url = f"{BASE}{path}"
    data = None
    req = urllib.request.Request(url, method=method)
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    req.data = data
    if cookies:
        req.add_header("Cookie", "; ".join(f"{k}={v}" for k, v in cookies.items()))
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            return res.status, res.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return -1, str(e)


def main() -> int:
    print(f"App flows against {BASE} with NEXT_PUBLIC_DATA_SOURCE=supabase\n")

    print("Sessions")
    # An exported NEXT_PUBLIC_DATA_SOURCE in the launching shell silently beats
    # .env.local, and mock mode answers every request with a fixture persona, so
    # the whole run would pass or fail for the wrong reason. Fail loudly instead.
    status, body = app("POST", "/api/verify-flows", body={"op": "whoami"})
    if status == 200 and '"js-' in body:
        print("  the server is running in mock mode, not against Supabase.")
        print("  unset NEXT_PUBLIC_DATA_SOURCE in the launching shell and retry.")
        return 1

    seeker_session = sign_in("selam.seeker@example.com")
    seeker = session_cookie(seeker_session)
    seeker_id = seeker_session["user"]["id"]
    retail = session_cookie(sign_in("abeba.retail@seed.skillconnect.et"))
    logistics = session_cookie(sign_in("nile.logistics@seed.skillconnect.et"))

    status, html = app("GET", "/sandbox", cookies=seeker)
    check("the app recognises a real session cookie", status == 200 and "Sign in" not in html[:2000],
          f"status {status}")
    if status != 200:
        print(html[:600])
        return 1

    # ------------------------------------------------------------------ grade
    print("\nPillar 2 — grading writes a score under the candidate's own session")
    _, before = rest(f"sandbox_scores?select=id&user_id=eq.{seeker_id}")
    n_before = len(before or [])

    submission = (
        "I would start by asking the AI for a first draft, then correct it. "
        "My prompt: 'You are helping a Merkato shop owner. Write a WhatsApp "
        "product listing in Amharic and English for 20 kg teff at 4200 birr, "
        "including price per kg, availability, and delivery inside Addis. Keep "
        "it under 60 words and friendly.' The first draft invented a discount "
        "we never offered, so I asked it again and told it not to add any offer "
        "that was not in my notes. I checked the price per kg myself: 4200 "
        "divided by 20 is 210 birr per kg. For the customer reply about a late "
        "delivery I would apologise, give the real new time, and offer to hold "
        "the stock, rather than blame the driver."
    )
    status, res = app("POST", "/api/sandbox/grade", cookies=seeker,
                      body={"nodeId": "merkato-whatsapp-catalog", "submission": submission})
    check("grade accepts a real submission", status == 200, f"status {status}: {str(res)[:300]}")

    _, after = rest(f"sandbox_scores?select=id,scores_json&user_id=eq.{seeker_id}")
    check("grading persisted a new sandbox_scores row", len(after or []) == n_before + 1,
          f"{n_before} -> {len(after or [])}")

    frozen = {"ai_prompt_literacy", "task_accuracy", "customer_comms",
              "data_tools", "process_thinking", "adaptability"}
    newest = (after or [{}])[-1].get("scores_json") or {}
    check("the graded row uses only frozen competency keys",
          set(newest) <= frozen and bool(newest), f"got {sorted(newest)}")

    # ------------------------------------------------------------------ match
    print("\nPillar 3 — matching ranks real candidates and writes the engine's scores")
    _, postings = rest("sme_postings?select=id,is_transition_role,sme_id")
    retail_posting = next(p["id"] for p in postings if not p["is_transition_role"])
    transition_posting = next(p["id"] for p in postings if p["is_transition_role"])

    status, res = app("POST", "/api/verify-flows", cookies=retail,
                      body={"op": "match", "postingId": retail_posting})
    check("match run completes as the posting owner", status == 200,
          f"status {status}: {str(res)[:300]}")
    if status == 200:
        payload = json.loads(res)
        check("the run produced at least one ranked candidate",
              payload.get("matched", 0) >= 1, f"matched {payload.get('matched')}")

    _, matches = rest(f"matches?select=id,match_score,gap_analysis,status,candidate_id,candidate_label,anonymous_label&posting_id=eq.{retail_posting}")
    check("matches were written with the engine's score",
          bool(matches) and all(m["match_score"] is not None for m in matches),
          f"{len(matches or [])} rows")
    check("a gap analysis was stored for each match",
          bool(matches) and all(m["gap_analysis"] for m in matches))

    # ------------------------------------------------------------- pgvector
    # Section 3's semantic layer. The columns are vector(1536); Postgres rejects
    # anything else, so a stored value is also proof of the right width.
    print("\nPhase 6 — the semantic layer persists to pgvector")
    _, posting_rows = rest(f"sme_postings?select=id,embedding&id=eq.{retail_posting}")
    role_vector = (posting_rows or [{}])[0].get("embedding")
    check("the match run stored the role vector on the posting",
          bool(role_vector), "sme_postings.embedding is still null")

    matched_ids = [m["candidate_id"] for m in matches or []]
    if matched_ids:
        ids = ",".join(matched_ids)
        _, matrices = rest(f"skill_matrices?select=user_id,embedding&user_id=in.({ids})")
        with_vector = [m for m in matrices or [] if m.get("embedding")]
        # A candidate with no skill_matrices row is skipped rather than created:
        # the matrix is Pillar 1's to write. So this asserts on rows that exist.
        check("every matched candidate holding a skill matrix has a vector",
              bool(matrices) and len(with_vector) == len(matrices),
              f"{len(with_vector)}/{len(matrices or [])} rows populated")

        if role_vector:
            width = len(json.loads(role_vector) if isinstance(role_vector, str) else role_vector)
            check("the stored vector is 1536-dimensional", width == 1536,
                  f"got {width}")

    # ------------------------------------------------------- candidate label
    # 0006 derives this from a trigger, which is what lets the ranked list name
    # a candidate without any SME read path onto profiles.
    print("\nRanked results label candidates without reading profiles")
    check("every match carries a display label",
          bool(matches) and all(m["candidate_label"] for m in matches),
          f"{sum(1 for m in matches or [] if m['candidate_label'])}/{len(matches or [])}")
    check("an opted-in candidate is shown by name, not as a letter",
          any(m["candidate_label"] != m["anonymous_label"] for m in matches or []),
          "every row fell back to the anonymous label")

    # Re-running must take the update branch, which is the path 0005 forbids on
    # the session client. This is the regression that motivated the fix.
    status, res = app("POST", "/api/verify-flows", cookies=retail,
                      body={"op": "match", "postingId": retail_posting})
    check("re-running a match updates rather than failing on column grants",
          status == 200, f"status {status}: {str(res)[:300]}")

    _, matches2 = rest(f"matches?select=id&posting_id=eq.{retail_posting}")
    check("re-running did not duplicate matches",
          len(matches2 or []) == len(matches or []),
          f"{len(matches or [])} -> {len(matches2 or [])}")

    # --------------------------------------------------------- match ownership
    print("\nOwnership still holds for the elevated write")
    status, res = app("POST", "/api/verify-flows", cookies=logistics,
                      body={"op": "match", "postingId": retail_posting})
    check("an SME cannot run a match on someone else's posting", status >= 400,
          f"status {status}")

    # ---------------------------------------------------------- notifications
    # The check runs on grading, over the candidate's best scores across every
    # node, so it has to be driven by a candidate who genuinely clears a
    # template. Meron's seeded scores clear Retail Inventory Assistant; Hanna's
    # do not clear anything, which makes her the opt-out control.
    print("\nNotifications")
    _, people = rest("profiles?select=id,full_name,role")
    who = {p["full_name"]: p["id"] for p in people}
    _, tmpls = rest("role_skill_templates?select=id,role_name,sme_id")
    retail_tmpl = next(t for t in tmpls if t["role_name"] == "Retail Inventory Assistant")

    set_password(who["Meron Tadesse"])
    meron = session_cookie(sign_in("meron.tadesse@seed.skillconnect.et"))
    rest(f"profiles?id=eq.{who['Meron Tadesse']}", method="PATCH",
         body={"opt_in_discoverable": True})
    rest(f"notifications?candidate_id=eq.{who['Meron Tadesse']}", method="DELETE")

    status, _ = app("POST", "/api/sandbox/grade", cookies=meron,
                    body={"nodeId": "merkato-whatsapp-catalog", "submission": submission})
    check("grading runs for a second candidate", status == 200, f"status {status}")

    _, notes = rest(
        f"notifications?select=id,sme_id,template_id,candidate_id,seen"
        f"&candidate_id=eq.{who['Meron Tadesse']}"
    )
    check("clearing a template's thresholds notified the SME", bool(notes),
          "no notification rows")
    if notes:
        check("the notification went to the template's owner",
              notes[0]["sme_id"] == retail_tmpl["sme_id"],
              f"{notes[0]['sme_id']} != {retail_tmpl['sme_id']}")
        check("it starts unseen so the bell shows it", notes[0]["seen"] is False)

    # Section 9: one notification per (sme, template, candidate), never a repeat.
    app("POST", "/api/sandbox/grade", cookies=meron,
        body={"nodeId": "merkato-whatsapp-catalog", "submission": submission})
    _, notes2 = rest(
        f"notifications?select=id&candidate_id=eq.{who['Meron Tadesse']}"
        f"&template_id=eq.{retail_tmpl['id']}"
    )
    check("re-grading does not send a duplicate notification",
          len(notes2 or []) == 1, f"{len(notes2 or [])} rows")

    # Section 9: a candidate who has not opted in is never evaluated.
    set_password(who["Hanna Girma"])
    hanna = session_cookie(sign_in("hanna.girma@seed.skillconnect.et"))
    rest(f"profiles?id=eq.{who['Hanna Girma']}", method="PATCH",
         body={"opt_in_discoverable": False})
    rest(f"notifications?candidate_id=eq.{who['Hanna Girma']}", method="DELETE")
    app("POST", "/api/sandbox/grade", cookies=hanna,
        body={"nodeId": "merkato-whatsapp-catalog", "submission": submission})
    _, optout = rest(f"notifications?select=id&candidate_id=eq.{who['Hanna Girma']}")
    check("a candidate who has not opted in is never notified about",
          not optout, f"{len(optout or [])} rows")

    # ------------------------------------------------------------- status flip
    if matches:
        print("\nShortlisting uses the one column an SME is granted")
        status, res = app("POST", "/api/verify-flows", cookies=retail,
                          body={"op": "status", "matchId": matches[0]["id"],
                                "postingId": retail_posting,
                                "status": "shortlisted"})
        check("SME can shortlist through their own session", status == 200,
              f"status {status}: {str(res)[:300]}")
        _, m = rest(f"matches?select=status&id=eq.{matches[0]['id']}")
        check("the status change persisted",
              m and m[0]["status"] == "shortlisted", f"got {m}")

    # ---------------------------------------------------------------- handover
    print("\nPillar 3b — a reviewed brief becomes a scored challenge")
    status, res = app("POST", "/api/verify-flows", cookies=logistics,
                      body={"op": "handover", "postingId": transition_posting})
    check("handover challenge generates from the reviewed brief", status == 200,
          f"status {status}: {str(res)[:300]}")

    _, briefs = rest(f"continuity_briefs?select=custom_node_id&posting_id=eq.{transition_posting}")
    check("the generated node id was written back to the brief",
          briefs and briefs[0]["custom_node_id"], f"got {briefs}")

    status, res = app("POST", "/api/verify-flows", cookies=retail,
                      body={"op": "handover", "postingId": transition_posting})
    check("another SME cannot generate from a brief they do not own", status >= 400,
          f"status {status}")

    # ------------------------------------------------- unreviewed brief (506)
    # "Continuity Briefs are unreachable until reviewed_by_employee = true."
    # Flip the seeded brief, confirm nothing leaks, and put it back.
    print("\nAn unreviewed brief is unreachable, not merely hidden")
    _, before = rest(f"continuity_briefs?select=id,generated_brief&posting_id=eq.{transition_posting}")
    brief_id = before[0]["id"] if before else None
    secret = (before[0].get("generated_brief") or "") if before else ""

    if brief_id:
        rest(f"continuity_briefs?id=eq.{brief_id}", method="PATCH",
             body={"reviewed_by_employee": False})
        try:
            status, html = app("GET", f"/matcher/postings/{transition_posting}",
                               cookies=logistics)
            check("the posting page renders without the brief card",
                  status == 200 and "Score candidates on this actual job" not in html,
                  f"status {status}")
            check("no awaiting-approval state is shown for a state that cannot be reached",
                  "Awaiting approval" not in html)
            leak = secret[:60].strip()
            check("the unreviewed brief text appears nowhere in the page",
                  bool(leak) and leak not in html, "brief text leaked into the HTML")

            status, res = app("POST", "/api/verify-flows", cookies=logistics,
                              body={"op": "handover", "postingId": transition_posting})
            check("generating a challenge from an unreviewed brief is refused",
                  status >= 400, f"status {status}: {str(res)[:200]}")
        finally:
            rest(f"continuity_briefs?id=eq.{brief_id}", method="PATCH",
                 body={"reviewed_by_employee": True})

    # ------------------------------------------------------------ public pages
    print("\nPublic surfaces")
    _, companies = rest("company_profiles?select=id,verified")
    verified = next((c for c in companies if c["verified"]), None)
    unverified = next((c for c in companies if not c["verified"]), None)
    if verified:
        status, html = app("GET", f"/company-profile/{verified['id']}")
        check("a verified company page renders for an anonymous visitor", status == 200,
              f"status {status}")
        check("it shows the AI-Forward badge", "AI-Forward" in html)
    if unverified:
        status, html = app("GET", f"/company-profile/{unverified['id']}")
        check("an unverified company page omits the badge",
              status == 200 and "AI-Forward" not in html, f"status {status}")

    print("")
    total = passes + len(failures)
    if failures:
        print(f"{len(failures)} of {total} checks FAILED:")
        for f in failures:
            print("  -", f)
        return 1
    print(f"All {total} app-flow checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
