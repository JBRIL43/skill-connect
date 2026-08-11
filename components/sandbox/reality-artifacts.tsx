"use client";

import { FileJson, ImageIcon } from "lucide-react";

import type { SourceArtifact } from "@/lib/sandbox/reality";

export function RealityArtifacts({
  artifacts,
}: {
  artifacts: SourceArtifact[];
}) {
  return (
    <div className="space-y-3">
      {artifacts.map((artifact) => (
        <div key={artifact.title} className="panel-muted space-y-2 p-3">
          <div className="flex items-start gap-2">
            {artifact.kind === "image" ? (
              <ImageIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-slate-400" />
            ) : (
              <FileJson aria-hidden className="mt-0.5 size-4 shrink-0 text-slate-400" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200">{artifact.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {artifact.description}
              </p>
            </div>
          </div>

          {artifact.kind === "image" ? (
            <div className="overflow-hidden rounded-lg border border-ink-600 bg-[#f4ecd8]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={artifact.src}
                alt={artifact.alt}
                className="h-auto w-full object-contain"
              />
            </div>
          ) : (
            <pre className="max-h-48 overflow-auto rounded-lg border border-ink-600 bg-ink-900 p-2 font-mono text-[10px] leading-relaxed text-slate-300">
              {artifact.payload.trim()}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
