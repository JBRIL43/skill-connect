/**
 * Optional "messy SME reality" layer on top of static sandbox nodes.
 * Keeps multimodal artifacts, curveballs, and incomplete briefs in config
 * rather than hardcoding them in the workspace UI.
 */

export type SourceArtifact =
  | {
      kind: "image";
      title: string;
      description: string;
      src: string;
      alt: string;
    }
  | {
      kind: "data";
      title: string;
      description: string;
      payload: string;
      format: "json" | "csv";
    };

export type AudioHandover = {
  title: string;
  sender: string;
  durationSeconds: number;
  /** Spoken script — grading checks whether the candidate captured key facts. */
  script: string;
  audioSrc?: string;
  keyFacts: string[];
};

export type IncompleteBrief = {
  vagueMessage: string;
  sender: string;
  clarifyingSignals: string[];
  minClarifications: number;
};

export type Curveball = {
  id: string;
  trigger: "afterUserTurns" | "afterSubmissionChars";
  threshold: number;
  channel: "whatsapp";
  sender: string;
  message: string;
};

export type RealityLayer = {
  sourceArtifacts?: SourceArtifact[];
  audioHandover?: AudioHandover;
  incompleteBrief?: IncompleteBrief;
  curveballs?: Curveball[];
  /** Pressure simulation persona — defaults to demanding manager. */
  pressurePersona?: "manager" | "angry_client";
};

export type RealitySession = {
  briefUnlocked: boolean;
  audioListened: boolean;
  firedCurveballs: string[];
  clarificationsAsked: number;
};

export function createRealitySession(layer?: RealityLayer): RealitySession {
  return {
    briefUnlocked: !layer?.incompleteBrief,
    audioListened: !layer?.audioHandover,
    firedCurveballs: [],
    clarificationsAsked: 0,
  };
}

/** Count how many clarifying signals appear across user chat turns. */
export function countClarifications(
  brief: IncompleteBrief,
  userMessages: string[],
): number {
  const haystack = userMessages.join(" ").toLowerCase();
  let hits = 0;
  for (const signal of brief.clarifyingSignals) {
    if (haystack.includes(signal.toLowerCase())) hits += 1;
  }
  return hits;
}

export function shouldUnlockBrief(
  brief: IncompleteBrief,
  clarificationsAsked: number,
): boolean {
  return clarificationsAsked >= brief.minClarifications;
}

export function pendingCurveballs(
  layer: RealityLayer | undefined,
  session: RealitySession,
  userTurns: number,
  submissionChars: number,
): Curveball[] {
  if (!layer?.curveballs?.length) return [];

  return layer.curveballs.filter((event) => {
    if (session.firedCurveballs.includes(event.id)) return false;
    if (event.trigger === "afterUserTurns") {
      return userTurns >= event.threshold;
    }
    return submissionChars >= event.threshold;
  });
}

/** Share of audio key facts referenced in chat + submission text. */
export function audioFactCoverage(
  handover: AudioHandover,
  text: string,
): number {
  if (handover.keyFacts.length === 0) return 1;
  const haystack = text.toLowerCase();
  const hits = handover.keyFacts.filter((fact) =>
    haystack.includes(fact.toLowerCase()),
  ).length;
  return hits / handover.keyFacts.length;
}
