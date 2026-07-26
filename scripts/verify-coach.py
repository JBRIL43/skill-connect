#!/usr/bin/env python3
"""Drives Pillar 1's coach as a job seeker, with no LLM key configured.

Every AI call in lib/ai/engine.ts goes through getAiModel(), which throws when
OPENAI_API_KEY is unset. Before the stub path existed, /coach rendered and then
returned 503 on the first message -- the page looked healthy right up until a
judge typed something, which is the worst place to find out.

This asserts the seeker can hold the conversation, build a skill map, and get
recommendations that deep-link to challenges that actually exist.

Start the app first:

    NEXT_PUBLIC_DATA_SOURCE=mock npm run dev

then run: npm run verify:coach
"""
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("VERIFY_BASE_URL", "http://localhost:3000").rstrip("/")
COOKIE = "sc_demo_profile"

JS_SELAM = "js-selam"   # a job seeker
SME_BOLE = "sme-bole"   # an employer, who must not be able to do any of this

# Real challenge ids from lib/ai/sandbox-catalog.ts, which must match Dev 3's
# registry or the recommendations deep-link to a 404.
CATALOG_IDS = {
    "merkato-whatsapp-catalog",
    "retail-inventory-tracker",
    "agritech-delivery-schedule",
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


def lower(headers):
    """Header case is not guaranteed across the dev server and a build."""
    return {key.lower(): value for key, value in headers.items()}


def call(path, profile=None, body=None, method="GET"):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    if profile:
        req.add_header("Cookie", f"{COOKIE}={profile}")
    try:
        with urllib.request.urlopen(req, timeout=90) as res:
            return res.status, res.read().decode(), lower(res.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(), lower(e.headers)
    except Exception as e:  # noqa: BLE001
        return -1, str(e), {}


def turns(*contents):
    """A transcript alternating user and assistant, as the client sends it."""
    messages = []
    for content in contents:
        messages.append({"role": "user", "content": content})
        messages.append({"role": "assistant", "content": "Understood."})
    return messages


def main() -> int:
    print(f"Pillar 1 coach against {BASE}\n")

    status, html, _ = call("/coach", profile=JS_SELAM)
    if status == -1:
        print(f"  the app is not answering on {BASE}.")
        print("  start it with: NEXT_PUBLIC_DATA_SOURCE=mock npm run dev")
        return 1

    print("The page a job seeker lands on")
    check("a job seeker can open /coach", status == 200, f"status {status}")
    check("and it is the coach, not a login wall",
          "AI Talent Discovery Coach" in html and "Create my skill map" in html)

    _, sme_html, _ = call("/coach", profile=SME_BOLE)
    check("an employer is sent away from it",
          "AI Talent Discovery Coach" not in sme_html)

    # ------------------------------------------------------------ the chat
    print("\nThe conversation holds up without an API key")
    status, reply, headers = call(
        "/api/ai/chat",
        profile=JS_SELAM,
        method="POST",
        body={"mode": "coach", "messages": [
            {"role": "user",
             "content": "I ran my aunt's shop for three years. I tracked stock "
                        "in a notebook and took orders on WhatsApp."},
        ]},
    )
    check("the first message gets an answer, not a 503", status == 200,
          f"status {status}: {reply[:200]}")
    check("served by the deterministic coach",
          headers.get("x-conversation-source") == "stub",
          f"source {headers.get('x-conversation-source')}")
    check("the answer is a real question, not a canned apology",
          len(reply.strip()) > 40 and "?" in reply, reply[:200])

    _, second, _ = call(
        "/api/ai/chat",
        profile=JS_SELAM,
        method="POST",
        body={"mode": "coach", "messages": turns("I sold clothes.", "Mostly WhatsApp.")},
    )
    check("it moves on rather than repeating itself", second.strip() != reply.strip(),
          "the same reply came back for a longer transcript")

    # ----------------------------------------------------------- skill map
    print("\nThe skill map is built from what was actually said")
    transcript = turns(
        "I ran my aunt's clothes shop in Merkato for three years.",
        "I tracked stock and daily sales in a notebook, and later a spreadsheet on my laptop.",
        "I used WhatsApp with customers every day and handled complaints myself.",
        "I have tried ChatGPT a few times to write product descriptions.",
        "One time a supplier failed us, so I called three others and solved it that afternoon.",
        "Transport is my main constraint, I travel an hour each way.",
    )

    status, raw, _ = call("/api/ai/skills", profile=JS_SELAM, method="POST",
                          body={"messages": transcript})
    check("the skill map saves", status == 200, f"status {status}: {raw[:250]}")

    matrix = None
    if status == 200:
        payload = json.loads(raw)
        matrix = payload.get("skills_json")
        check("it comes back with a readiness score",
              isinstance(payload.get("readiness_score"), int),
              str(payload.get("readiness_score")))
        check("labelled an initial read rather than a verified score",
              "not a verified" in (payload.get("disclaimer") or "").lower(),
              payload.get("disclaimer"))
        check("every axis is a real 0-100 score",
              matrix is not None
              and all(isinstance(v, int) and 0 <= v <= 100
                      for v in {**matrix["technical"], **matrix["human"]}.values()),
              json.dumps(matrix)[:200] if matrix else "no matrix")
        if matrix:
            axes = {**matrix["technical"], **matrix["human"]}
            # Someone who described WhatsApp, complaints and customers every day
            # should not read identically to someone who described none of it.
            check("it reads the transcript instead of returning a flat default",
                  len(set(axes.values())) > 1, json.dumps(axes))
            check("and rates communication above nothing-mentioned empathy",
                  matrix["human"]["communication"] >= matrix["human"]["empathy"],
                  f"comms {matrix['human']['communication']} vs empathy {matrix['human']['empathy']}")

    status, _, _ = call("/api/ai/skills", profile=SME_BOLE, method="POST",
                        body={"messages": transcript})
    check("an employer cannot create one", status == 403, f"status {status}")

    # ------------------------------------------------------ recommendations
    print("\nRecommendations point at challenges that exist")
    if matrix:
        status, raw, _ = call("/api/ai/recommendations", profile=JS_SELAM,
                              method="POST", body={"skills_json": matrix})
        check("recommendations return", status == 200, f"status {status}: {raw[:250]}")

        if status == 200:
            items = json.loads(raw).get("recommendations", [])
            check("there are at least two", len(items) >= 2, f"got {len(items)}")

            ids = [c["node_id"] for item in items for c in item.get("challenges", [])]
            check("every one deep-links to a real challenge",
                  bool(ids) and all(i in CATALOG_IDS for i in ids), str(ids))

            # The whole point of the deep link. A 404 here is the demo dying on
            # the one click a judge is most likely to make.
            for node_id in dict.fromkeys(ids):
                code, _, _ = call(f"/sandbox/{node_id}", profile=JS_SELAM)
                check(f"the seeker can open {node_id}", code == 200, f"status {code}")

    print("")
    total = passes + len(failures)
    if failures:
        print(f"{len(failures)} of {total} checks FAILED:")
        for f in failures:
            print("  -", f)
        return 1

    print(f"All {total} coach checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
