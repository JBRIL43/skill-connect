"use client";

import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { competencyLabel } from "@/lib/sandbox/competencies";
import type { SandboxTreeEdge, SandboxTreeNode } from "@/lib/sandbox/tree";
import { TONE } from "@/lib/tones";
import { cn } from "@/lib/utils";

type ChallengeNodeData = SandboxTreeNode & { unlocked: boolean };
type ChallengeFlowNode = Node<ChallengeNodeData, "challenge">;

const sectorLabels: Record<SandboxTreeNode["sector"], string> = {
  textiles: "Textiles",
  retail: "Retail",
  agritech: "Agritech",
  transition: "Transition role",
};

function ChallengeNode({ data, selected }: NodeProps<ChallengeFlowNode>) {
  return (
    <div
      className={cn(
        "w-[290px] cursor-pointer rounded-xl border bg-ink-900 p-4 text-left transition-colors",
        data.completed
          ? "border-verdant-500/50"
          : data.generated
            ? "border-award-500/50 hover:border-award-400/70"
            : "border-ink-700 hover:border-verdant-500/40",
        selected && "ring-2 ring-verdant-500/30",
      )}
    >
      <Handle type="target" position={Position.Top} />

      <div className="flex items-center justify-between gap-2">
        <span className="label-caps">{sectorLabels[data.sector]}</span>
        {data.completed ? (
          <Badge className={TONE.verified}>{data.overallScore}/100</Badge>
        ) : (
          <span className="text-[11px] text-slate-500">
            {data.estimatedMinutes} min
          </span>
        )}
      </div>

      {data.generated ? (
        <p className="mt-2 text-[11px] font-medium text-award-400">
          Open role — scored on the actual job
        </p>
      ) : null}

      <h3 className="mt-2 text-sm font-semibold leading-snug text-slate-100">
        {data.title}
      </h3>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
        {data.summary}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {data.competencies.map((competency) => (
          <span
            key={competency}
            className="rounded-md bg-ink-800 px-1.5 py-0.5 text-[10px] text-slate-400"
          >
            {competencyLabel(competency)}
          </span>
        ))}
      </div>

      {data.badgeName ? (
        <p className="mt-3 text-[11px] font-medium text-award-400">
          {data.badgeName} earned
        </p>
      ) : !data.unlocked ? (
        <p className="mt-3 text-[11px] text-slate-500">
          Recommended after the challenge above
        </p>
      ) : null}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { challenge: ChallengeNode };

export function SandboxNodeTree({
  nodes,
  edges,
}: {
  nodes: SandboxTreeNode[];
  edges: SandboxTreeEdge[];
}) {
  const router = useRouter();

  const flowNodes = useMemo<ChallengeFlowNode[]>(() => {
    const completedIds = new Set(
      nodes.filter((node) => node.completed).map((node) => node.id),
    );

    return nodes.map((node) => ({
      id: node.id,
      type: "challenge" as const,
      position: { x: node.x, y: node.y },
      data: {
        ...node,
        unlocked: node.requires.every((id) => completedIds.has(id)),
      },
    }));
  }, [nodes]);

  const flowEdges = useMemo<Edge[]>(
    () =>
      edges.map((edge) => {
        const source = nodes.find((node) => node.id === edge.source);
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          animated: Boolean(source?.completed),
        };
      }),
    [edges, nodes],
  );

  return (
    <div className="h-[560px] overflow-hidden rounded-xl border border-ink-700 bg-ink-950/60">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => router.push(`/sandbox/${node.id}`)}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#212a36" />
      </ReactFlow>
    </div>
  );
}
