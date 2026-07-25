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
