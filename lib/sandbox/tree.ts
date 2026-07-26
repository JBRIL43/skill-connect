import type { SandboxNode } from "@/lib/sandbox/nodes";

export type SandboxTreeNode = {
  id: string;
  title: string;
  titleAm: string;
  sector: SandboxNode["sector"];
  difficulty: SandboxNode["difficulty"];
  estimatedMinutes: number;
  summary: string;
  competencies: string[];
  requires: string[];
  completed: boolean;
  overallScore: number | null;
  badgeName: string | null;
  generated: boolean;
  x: number;
  y: number;
};

export type SandboxTreeEdge = { id: string; source: string; target: string };

const ROW_HEIGHT = 200;
const COLUMN_WIDTH = 330;

/**
 * Positions the node tree by prerequisite depth. Section 3 asks for a tree
 * generated from the user's skill matrix; this keeps the shape deterministic so
 * the same demo always looks the same on stage, and generated Pillar 3b
 * challenges branch off to the side of the depth they were unlocked at.
 */
export function buildSandboxTree(
  nodes: SandboxNode[],
  progress: Map<string, { overallScore: number; badgeName: string | null }>,
): { nodes: SandboxTreeNode[]; edges: SandboxTreeEdge[] } {
  const depths = new Map<string, number>();

  const depthOf = (node: SandboxNode, seen = new Set<string>()): number => {
    if (depths.has(node.id)) return depths.get(node.id)!;
    if (seen.has(node.id)) return 0;
    seen.add(node.id);

    const parentDepths = node.requires.map((requiredId) => {
      const parent = nodes.find((candidate) => candidate.id === requiredId);
      return parent ? depthOf(parent, seen) + 1 : 0;
    });

    const depth = parentDepths.length ? Math.max(...parentDepths) : 0;
    depths.set(node.id, depth);
    return depth;
  };

  nodes.forEach((node) => depthOf(node));

  const perDepth = new Map<number, number>();
  const treeNodes: SandboxTreeNode[] = nodes.map((node) => {
    const depth = depths.get(node.id) ?? 0;
    const column = perDepth.get(depth) ?? 0;
    perDepth.set(depth, column + 1);
    const result = progress.get(node.id);

    return {
      id: node.id,
      title: node.title,
      titleAm: node.titleAm,
      sector: node.sector,
      difficulty: node.difficulty,
      estimatedMinutes: node.estimatedMinutes,
      summary: node.summary,
      competencies: node.rubric.map((line) => line.competency),
      requires: node.requires,
      completed: Boolean(result),
      overallScore: result?.overallScore ?? null,
      badgeName: result?.badgeName ?? null,
      generated: Boolean(node.generatedFromPostingId),
      x: column * COLUMN_WIDTH,
      y: depth * ROW_HEIGHT,
    };
  });

  const edges: SandboxTreeEdge[] = [];
  for (const node of nodes) {
    for (const requiredId of node.requires) {
      if (!nodes.some((candidate) => candidate.id === requiredId)) continue;
      edges.push({
        id: `${requiredId}->${node.id}`,
        source: requiredId,
        target: node.id,
      });
    }
  }

  return { nodes: treeNodes, edges };
}
