"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  COMPETENCY_LIST,
  type CompetencyKey,
} from "@/lib/sandbox/competencies";
import { TONE } from "@/lib/tones";
import { Badge } from "@/components/ui/badge";

import {
  createTemplateAction,
  draftTemplateAction,
  type CreateTemplateState,
} from "./actions";

const DEFAULT_MINIMUM = 70;

type Row = { enabled: boolean; minimum: number };

function emptyRows(): Record<CompetencyKey, Row> {
  return COMPETENCY_LIST.reduce(
    (acc, meta) => {
      acc[meta.key] = { enabled: false, minimum: DEFAULT_MINIMUM };
      return acc;
    },
    {} as Record<CompetencyKey, Row>,
  );
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "Saving…" : "Save this template"}
    </Button>
  );
}

export function TemplateBuilderForm() {
  const [state, formAction] = useActionState<CreateTemplateState, FormData>(
    createTemplateAction,
    {},
  );

  const [roleName, setRoleName] = useState("");
  const [rows, setRows] = useState<Record<CompetencyKey, Row>>(emptyRows);
  const [problem, setProblem] = useState("");
  const [rationale, setRationale] = useState<string | null>(null);
  const [draftSource, setDraftSource] = useState<"live" | "stub" | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [drafting, startDrafting] = useTransition();

  const enabledCount = COMPETENCY_LIST.filter(
    (meta) => rows[meta.key].enabled,
  ).length;

  function requestDraft() {
    setDraftError(null);
    startDrafting(async () => {
      const result = await draftTemplateAction(problem);

      if (!result.ok) {
        setDraftError(result.error);
        return;
      }

      const next = emptyRows();
      for (const [key, minimum] of Object.entries(result.draft.thresholds_json)) {
        if (minimum === undefined) continue;
        next[key as CompetencyKey] = { enabled: true, minimum };
      }

      setRows(next);
      setRoleName(result.draft.role_name);
      setRationale(result.draft.rationale);
      setDraftSource(result.draft.source);
    });
  }

  function toggle(key: CompetencyKey) {
    setRows((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));
  }

  function setMinimum(key: CompetencyKey, value: number) {
    setRows((prev) => ({
      ...prev,
      [key]: { ...prev[key], minimum: value },
    }));
  }

  return (
    <div className="space-y-5">
      <Card className="panel">
        <CardHeader>
          <CardTitle>Describe the problem instead</CardTitle>
          <CardDescription>
            Say what is going wrong in plain words and get a proposed bar back.
            Nothing is saved until you confirm it below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={4}
            value={problem}
            onChange={(event) => setProblem(event.target.value)}
            placeholder="We are losing WhatsApp orders because one person answers every message by hand, and prices are only in a notebook."
          />

          {draftError ? (
            <p className="text-sm text-gap-400" role="alert">
              {draftError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={requestDraft}
              disabled={drafting}
            >
              {drafting ? "Drafting…" : "Draft the thresholds for me"}
            </Button>

            {draftSource ? (
              <Badge
                className={draftSource === "live" ? TONE.info : TONE.neutral}
              >
                {draftSource === "live" ? "AI drafted" : "Drafted offline"}
              </Badge>
            ) : null}
          </div>

          {rationale ? (
            <div className="panel-muted p-3">
              <p className="label-caps">Why these thresholds</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                {rationale}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <form action={formAction}>
        <Card className="panel">
          <CardHeader>
            <CardTitle>The bar you hire against</CardTitle>
            <CardDescription>
              A candidate only appears in your results once they clear every
              threshold you keep enabled.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="role_name">Role name</Label>
              <Input
                id="role_name"
                name="role_name"
                value={roleName}
                onChange={(event) => setRoleName(event.target.value)}
                placeholder="AI Sales Assistant (WhatsApp)"
                required
              />
            </div>

            <div className="space-y-3">
              <p className="label-caps">Competencies and minimum scores</p>

              {COMPETENCY_LIST.map((meta) => {
                const row = rows[meta.key];
                return (
                  <div
                    key={meta.key}
                    className={
                      row.enabled
                        ? "panel-muted border-verdant-500/30 p-3"
                        : "panel-muted p-3"
                    }
                  >
                    <div className="flex items-start justify-between gap-4">
                      <label className="flex flex-1 cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={() => toggle(meta.key)}
                          className="mt-1 size-4 accent-verdant-500"
                        />
                        <span>
                          <span className="block text-sm font-medium text-slate-100">
                            {meta.label}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                            {meta.description}
                          </span>
                        </span>
                      </label>

                      {row.enabled ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <input
                            type="range"
                            min={40}
                            max={95}
                            value={row.minimum}
                            onChange={(event) =>
                              setMinimum(meta.key, Number(event.target.value))
                            }
                            className="w-28 accent-verdant-500"
                            aria-label={`Minimum score for ${meta.label}`}
                          />
                          <span className="w-8 font-mono text-sm text-verdant-400">
                            {row.minimum}
                          </span>
                          <input
                            type="hidden"
                            name={`threshold_${meta.key}`}
                            value={row.minimum}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="notify_on_match"
                defaultChecked
                className="mt-1 size-4 accent-verdant-500"
              />
              <span>
                <span className="block text-sm font-medium text-slate-100">
                  Notify me when someone clears this bar
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                  Checked against every new sandbox score, so you hear about a
                  candidate the moment they qualify rather than when you next log
                  in.
                </span>
              </span>
            </label>

            {state.error ? (
              <p className="text-sm text-gap-400" role="alert">
                {state.error}
              </p>
            ) : null}

            <div className="flex items-center gap-3">
              <SaveButton disabled={enabledCount === 0} />
              <p className="text-[11px] text-slate-500">
                {enabledCount === 0
                  ? "Enable at least one competency."
                  : `${enabledCount} threshold${enabledCount === 1 ? "" : "s"} on this role.`}
              </p>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
