import { generateLocally, transitionNodeId } from "@/lib/ai/challenge-gen";
import { repo } from "@/lib/data";
import { SANDBOX_NODES, getStaticNode, type SandboxNode } from "@/lib/sandbox/nodes";

const TRANSITION_PREFIX = "transition-";

/**
 * Resolves any node id to a challenge, whether it is one of the three authored
 * challenges or a Pillar 3b challenge generated from a reviewed handover.
 *
 * Generated bodies have no home in Section 8's flat schema (only
 * continuity_briefs.custom_node_id exists), so a cold cache is rebuilt
 * deterministically from the reviewed brief rather than becoming a dead link.
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

  const brief = await repo().getBriefByPosting(postingId);
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

/** The authored challenges plus every generated transition challenge. */
export async function listAllNodes(): Promise<SandboxNode[]> {
  const generated = await repo().listGeneratedChallenges();
  return [
    ...SANDBOX_NODES,
    ...generated.map((row) => row.payload as SandboxNode),
  ];
}

export { transitionNodeId };
