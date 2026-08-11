/**
 * Development-only verification harness for scripts/verify-app-flows.py.
 *
 * The Pillar 3 mutations are useActionState server actions, which a script
 * cannot invoke directly. This exposes them over HTTP so the live run exercises
 * the real actions, with the real session cookie and the real ownership checks,
 * rather than a reimplementation that could drift from them.
 *
 * Every action still enforces requireOwnedPosting, so this grants no privilege
 * a signed-in user does not already have. It is still refused outside
 * development: a server action reachable as a plain POST has none of the CSRF
 * protection Next.js gives the real thing.
 *
 * The actions return { error } rather than throwing, so that is mapped to 403
 * to keep the pass/fail signal on the status code.
 */
import { NextResponse } from "next/server";

import {
  generateHandoverChallengeAction,
  runMatchAction,
  setMatchStatusAction,
} from "@/app/matcher/actions";
import { currentProfile } from "@/lib/current-profile";
import { repo } from "@/lib/data";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await request.json();
  const form = new FormData();

  if (body.op === "whoami") {
    const profile = await currentProfile();
    const posting = body.postingId
      ? await repo().getPosting(String(body.postingId))
      : null;
    return NextResponse.json({
      profile: profile && { id: profile.id, role: profile.role },
      posting: posting && { id: posting.id, sme_id: posting.sme_id },
    });
  }

  // Mock-only introspection, for scripts/verify-mock-flows.py. The mock store is
  // in-process, so there is no psql equivalent to assert against and no way to
  // set up a state the fixtures do not already ship. Refused against a real
  // database, where these would be a way to edit another user's data.
  if (body.op?.startsWith("mock:")) {
    if (repo().kind !== "mock") {
      return NextResponse.json({ error: "mock mode only" }, { status: 400 });
    }

    if (body.op === "mock:inspect") {
      const posting = await repo().getPosting(String(body.postingId));
      const matches = await repo().listMatchesForPosting(String(body.postingId));
      const matrices = await Promise.all(
        matches.map(async (match) => ({
          user_id: match.candidate_id,
          dimensions:
            (await repo().getSkillMatrix(match.candidate_id))?.embedding
              ?.length ?? null,
        })),
      );

      return NextResponse.json({
        postingDimensions: posting?.embedding?.length ?? null,
        matches: matches.map((match) => ({
          candidate_id: match.candidate_id,
          candidate_label: match.candidate_label,
          anonymous_label: match.anonymous_label,
          match_score: match.match_score,
        })),
        matrices,
      });
    }

    if (body.op === "mock:set-optin") {
      await repo().setOptInDiscoverable(String(body.userId), Boolean(body.value));
      return NextResponse.json({ ok: true });
    }

    // Simulates the cold instance that most requests actually land on. The
    // generated-challenge store is a per-process memo, so a suite that only ever
    // reads it warm cannot tell working code from code that depends on having
    // generated the node itself moments earlier.
    if (body.op === "mock:clear-generated") {
      const { store } = await import("@/lib/data/mock/store");
      const cleared = store().generatedChallenges.length;
      store().generatedChallenges.length = 0;
      return NextResponse.json({ cleared });
    }

    if (body.op === "mock:set-brief-review") {
      const brief = await repo().getBriefByPosting(String(body.postingId));
      // Reading it back is impossible once unreviewed, by design, so the store
      // is reached through the same seam the adapter uses.
      const { store } = await import("@/lib/data/mock/store");
      const row = store().continuityBriefs.find(
        (item) => item.posting_id === String(body.postingId),
      );
      if (row) row.reviewed_by_employee = Boolean(body.value);
      return NextResponse.json({ ok: Boolean(row), wasVisible: Boolean(brief) });
    }
  }

  if (body.op === "match") {
    form.set("posting_id", String(body.postingId));
    const result = await runMatchAction({}, form);
    if (result.error) return NextResponse.json(result, { status: 403 });
    return NextResponse.json(result);
  }

  if (body.op === "status") {
    form.set("match_id", String(body.matchId));
    form.set("posting_id", String(body.postingId ?? ""));
    form.set("status", String(body.status));
    const result = await setMatchStatusAction({}, form);
    if (result.error) return NextResponse.json(result, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  if (body.op === "handover") {
    form.set("posting_id", String(body.postingId));
    const result = await generateHandoverChallengeAction({}, form);
    if (result.error) return NextResponse.json(result, { status: 403 });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "unknown op" }, { status: 400 });
}
