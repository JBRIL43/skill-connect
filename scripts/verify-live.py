#!/usr/bin/env python3
"""Live verification of the Dev 3 surface against real RLS.

Runs as real signed-in users through PostgREST, not through the service role,
because the whole question is what a session is actually allowed to do. Covers
the four QA probes in docs/RLS_MODEL.md plus the Dev 3 paths that depend on
them: threshold matching, the column grants from 0005, and the handover brief.

Reads credentials from .env.local. Run with: python3 scripts/verify-live.py
"""
import json
import os
import sys
import urllib.error
import urllib.request

SEED_PASSWORD = "Test1234!"


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

failures = []
passes = 0


def request(method, path, token=None, body=None, headers=None, base=None):
    """Returns (status, parsed_json_or_text)."""
    url = f"{base or URL}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", ANON if token != SERVICE else SERVICE)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
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


def rest(path, token, method="GET", body=None, headers=None):
    return request(method, f"/rest/v1/{path}", token=token, body=body, headers=headers)


def sign_in(email, password=SEED_PASSWORD):
    status, res = request(
        "POST",
        "/auth/v1/token?grant_type=password",
        body={"email": email, "password": password},
    )
    if status != 200 or not isinstance(res, dict) or "access_token" not in res:
        return None
    return res["access_token"]


def set_password(user_id, password=SEED_PASSWORD):
    return request(
        "PUT",
        f"/auth/v1/admin/users/{user_id}",
        token=SERVICE,
        body={"password": password},
    )


def rows(result):
    """Row count, or -1 when the request was refused outright."""
    status, body = result
    if status >= 400 or not isinstance(body, list):
        return -1
    return len(body)


def check(label, ok, detail=""):
    global passes
    if ok:
        passes += 1
        print(f"  PASS  {label}")
    else:
        failures.append(label)
        print(f"  FAIL  {label}  {detail}")


def denied(label, result):
    """A deny is zero rows (RLS filtered) or an error (refused). Both are fine."""
    n = rows(result)
    check(label, n <= 0, f"leaked {n} row(s)")


def main() -> int:
    print("Live verification against real RLS\n")

    # ---------------------------------------------------------------- accounts
    print("Accounts")
    status, users = rest(
        "profiles?select=id,role,full_name", SERVICE
    )
    if status >= 400:
        print("  could not read profiles with the service role:", users)
        return 1
    by_name = {u["full_name"]: u for u in users}

    # Seed SMEs were created without a known password; set one so the live test
    # can run as the actual posting owner rather than a stand-in.
    for name in ("Abeba Mekonnen", "Yonas Alemu"):
        if name in by_name:
            set_password(by_name[name]["id"])

    seeker = sign_in("selam.seeker@example.com")
    admin_acct = sign_in("sneaky.admin@example.com")
    retail_sme = sign_in("abeba.retail@seed.skillconnect.et")
    logistics_sme = sign_in("nile.logistics@seed.skillconnect.et")

    check("signed in as a job seeker", seeker is not None)
    check("signed in as the retail SME", retail_sme is not None)
    check("signed in as the logistics SME", logistics_sme is not None)
    if not (seeker and retail_sme and logistics_sme):
        print("\ncannot continue without sessions")
        return 1

    # ------------------------------------------------------ RLS_MODEL.md probes
    print("\nQA probe 1 — a job seeker cannot read another's data")
    denied("other seeker's skill_matrices", rest("skill_matrices?select=id&user_id=neq." + by_name["Selam Tesfaye"]["id"], seeker))
    denied("other seeker's sandbox_scores", rest("sandbox_scores?select=id&user_id=neq." + by_name["Selam Tesfaye"]["id"], seeker))

    print("\nQA probe 2 — an SME cannot read a candidate's skill_matrices")
    denied("SME reads skill_matrices", rest("skill_matrices?select=id", retail_sme))
    denied("SME reads sandbox_scores", rest("sandbox_scores?select=id", retail_sme))
    check(
        "SME sees only their own profile row",
        rows(rest("profiles?select=id", retail_sme)) == 1,
        f"got {rows(rest('profiles?select=id', retail_sme))}",
    )

    print("\nQA probe 3 — continuity_briefs are not readable by the wrong SME")
    # The brief belongs to the logistics SME's transition posting.
    denied("other SME reads the brief", rest("continuity_briefs?select=id", retail_sme))
    denied("job seeker reads any brief", rest("continuity_briefs?select=id", seeker))

    print("\nQA probe 4 — cross-company data stays private")
    # Once matching has run, an SME legitimately has notifications of their own,
    # so "reads nothing" is the wrong bar. The question is whether the rows they
    # can see are only ever theirs.
    retail_id = by_name["Abeba Mekonnen"]["id"]
    _, visible = rest("notifications?select=id,sme_id", retail_sme)
    check(
        "an SME sees only notifications addressed to them",
        isinstance(visible, list)
        and all(n["sme_id"] == retail_id for n in visible),
        f"saw {[n['sme_id'] for n in visible] if isinstance(visible, list) else visible}",
    )
    denied(
        "SME cannot read another SME's notifications",
        rest(f"notifications?select=id&sme_id=neq.{retail_id}", retail_sme),
    )
    denied("SME reads another company's payments", rest("payments?select=id", retail_sme))
    denied("anonymous reads profiles", rest("profiles?select=id", None))
    denied("anonymous reads sandbox_scores", rest("sandbox_scores?select=id", None))

    # ------------------------------------------------- Dev 3's own assumptions
    print("\nDev 3's service-role split")
    denied("SME cannot read candidate scores (why the match run is elevated)",
           rest("sandbox_scores?select=id", retail_sme))
    denied("SME cannot read candidate profiles (the identity gap)",
           rest("profiles?select=id&role=eq.job_seeker", retail_sme))
    status, _ = rest("notifications", seeker, method="POST",
                     body={"sme_id": by_name["Abeba Mekonnen"]["id"],
                           "template_id": "00000000-0000-0000-0000-000000000000",
                           "candidate_id": by_name["Selam Tesfaye"]["id"]})
    check("a user cannot insert a notification (why the check is elevated)", status >= 400,
          f"status {status}")

    print("\nColumn grants from 0005")
    seeker_id = by_name["Selam Tesfaye"]["id"]
    status, body = rest(f"profiles?id=eq.{seeker_id}", seeker, method="PATCH",
                        body={"role": "admin"})
    role_now = rest(f"profiles?select=role&id=eq.{seeker_id}", SERVICE)[1]
    check("job seeker cannot promote themselves to admin",
          status >= 400 and role_now and role_now[0]["role"] == "job_seeker",
          f"status {status}, role now {role_now}")

    # PostgREST answers 204 even when RLS filtered the row to nothing, so the
    # status alone proves nothing. Read the value back.
    rest(f"profiles?id=eq.{seeker_id}", seeker, method="PATCH",
         body={"opt_in_discoverable": False})
    status, _ = rest(f"profiles?id=eq.{seeker_id}", seeker, method="PATCH",
                     body={"opt_in_discoverable": True})
    _, back = rest(f"profiles?select=opt_in_discoverable&id=eq.{seeker_id}", SERVICE)
    check("job seeker can still set their own discoverability",
          status < 400 and back and back[0]["opt_in_discoverable"] is True,
          f"status {status}, value now {back}")

    # ------------------------------------------------------- frozen vocabulary
    print("\nFrozen competency vocabulary")
    frozen = {"ai_prompt_literacy", "task_accuracy", "customer_comms",
              "data_tools", "process_thinking", "adaptability"}
    _, scores = rest("sandbox_scores?select=scores_json", SERVICE)
    _, templates = rest("role_skill_templates?select=role_name,thresholds_json", SERVICE)
    score_keys = {k for r in (scores or []) for k in (r["scores_json"] or {})}
    thr_keys = {k for r in (templates or []) for k in (r["thresholds_json"] or {})}
    check("every sandbox_scores key is in the frozen vocabulary",
          score_keys <= frozen, f"stray: {sorted(score_keys - frozen)}")
    check("every threshold key is in the frozen vocabulary",
          thr_keys <= frozen, f"stray: {sorted(thr_keys - frozen)}")
    check("thresholds and scores share a vocabulary, so matching can succeed",
          bool(thr_keys & score_keys), f"no overlap: {sorted(thr_keys)} vs {sorted(score_keys)}")

    # ------------------------------------------------------------ handover data
    print("\nPillar 3b data")
    _, briefs = rest("continuity_briefs?select=id,reviewed_by_employee,custom_node_id", SERVICE)
    check("a reviewed handover brief exists to generate from",
          any(b["reviewed_by_employee"] for b in (briefs or [])))

    print("")
    total = passes + len(failures)
    if failures:
        print(f"{len(failures)} of {total} checks FAILED:")
        for f in failures:
            print("  -", f)
        return 1
    print(f"All {total} live checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
