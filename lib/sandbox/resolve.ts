import { generateLocally, transitionNodeId } from "@/lib/ai/challenge-gen";
import { repo } from "@/lib/data";
import { SANDBOX_NODES, getStaticNode, type SandboxNode } from "@/lib/sandbox/nodes";

const TRANSITION_PREFIX = "transition-";

/**
 * Resolves any node id to a challenge, whether it is one of the three authored
 * challenges or a Pillar 3b challenge generated from a reviewed handover.
 *
 * Generated bodies have no home in Section 8's flat schema (only
 * continuity_briefs.custom_node_id exists), so the store behind
 * getGeneratedChallenge is a per-process memo, not storage. Everything below it
 * therefore has to work from a cold cache on every request, because on a
 * multi-instance host most requests land on an instance that has never seen this
 * node. generateLocally is deterministic and does no I/O, so rebuilding is
 * cheap and returns byte-identical content.
 */
export async function resolveNode(nodeId: string): Promise<SandboxNode | null> {
  const authored = getStaticNode(nodeId);
  if (authored) return authored;

  const cached = await repo().getGeneratedChallenge(nodeId);
  if (cached) return cached.payload as SandboxNode;

  if (!nodeId.startsWith(TRANSITION_PREFIX)) return null;

  const postingId = nodeId.slice(TRANSITION_PREFIX.length);
  const posting = await repo().getPosting(postingId);
  if (!posting) return null;

  // Not getBriefByPosting: that is scoped to the owning SME, and the candidate
  // taking this challenge never owns the posting. See the interface for why
  // reading past that policy is safe here.
  const brief = await repo().getReviewedBriefForChallenge(postingId);
  if (!brief || !brief.reviewed_by_employee) return null;

  const template = posting.template_id
    ? await repo().getTemplate(posting.template_id)
    : null;

  const node = generateLocally({
    posting,
    brief,
    thresholds: template?.thresholds_json,
  });

  await repo().saveGeneratedChallenge({
    node_id: node.id,
    posting_id: postingId,
    payload: node,
  });

  return node;
}

/**
 * The authored challenges plus every generated transition challenge.
 *
 * Derived from the open transition postings rather than from the memo, so the
 * tree contains the same nodes on every instance. Reading the memo instead meant
 * a transition challenge appeared only for whoever's process had generated it —
 * an SME could build one, and the candidate hitting a different instance would
 * not see it in the tree at all.
 */
export async function listAllNodes(): Promise<SandboxNode[]> {
  const postings = await repo().listOpenTransitionPostings();
  const generated = await Promise.all(
    postings.map((posting) => resolveNode(transitionNodeId(posting.id))),
  );

  return [
    ...SANDBOX_NODES,
    ...generated.filter((node): node is SandboxNode => node !== null),
  ];
}

export { transitionNodeId };
