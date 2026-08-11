"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  INTERVIEW_QUESTIONS,
  type InterviewAnswers,
  type InterviewQuestionId,
} from "@/lib/handover/interview";

import { saveInterviewAction, type InterviewState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Writing the brief…" : "Write the brief"}
    </Button>
  );
}

/**
 * One question at a time, because the person answering is a warehouse
 * supervisor on their last week, not someone filling in a form. Answers live in
 * client state until the end and post in a single action, so a half-finished
 * interview never lands in the table as a half-finished brief.
 */
export function InterviewForm({
  postingId,
  initialAnswers,
}: {
  postingId: string;
  initialAnswers: InterviewAnswers;
}) {
  const [answers, setAnswers] = useState<InterviewAnswers>(initialAnswers);
  const [step, setStep] = useState(0);
  const [state, formAction] = useActionState<InterviewState, FormData>(
    saveInterviewAction,
    {},
  );

  const question = INTERVIEW_QUESTIONS[step];
  const last = step === INTERVIEW_QUESTIONS.length - 1;
  const value = answers[question.id] ?? "";
  const blocked = question.required && !value.trim();

  function set(id: InterviewQuestionId, next: string) {
    setAnswers((prev) => ({ ...prev, [id]: next }));
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="posting_id" value={postingId} />
      {INTERVIEW_QUESTIONS.map((item) => (
        <input
          key={item.id}
          type="hidden"
          name={item.id}
          value={answers[item.id] ?? ""}
        />
      ))}

      <div className="flex items-center gap-1.5" aria-hidden>
        {INTERVIEW_QUESTIONS.map((item, index) => (
          <span
            key={item.id}
            className={`h-1 flex-1 rounded-full transition-colors ${
              index <= step ? "bg-verdant-500" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      <div className="space-y-2">
        <p className="label-caps">
          Question {step + 1} of {INTERVIEW_QUESTIONS.length}
        </p>
        <label
          htmlFor="interview-answer"
          className="block text-lg font-medium tracking-tight"
        >
          {question.prompt}
        </label>
        <p className="text-xs leading-relaxed text-slate-500">{question.hint}</p>
      </div>

      <textarea
        id="interview-answer"
        // Remounts per question so the browser does not carry the caret or an
        // undo stack from the previous answer into the next one.
        key={question.id}
        className="field min-h-32 w-full resize-y"
        rows={question.list ? 5 : 3}
        defaultValue={value}
        onChange={(event) => set(question.id, event.target.value)}
        placeholder={question.list ? "One per line" : ""}
      />

      {state.gaps?.length ? (
        <div className="panel-muted p-3" role="alert">
          <p className="label-caps text-gap-400">Not enough to build on yet</p>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-slate-300">
            {state.gaps.map((gap) => (
              <li key={gap}>— {gap}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {state.error ? (
        <p className="text-sm text-gap-400" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {step > 0 ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep((current) => current - 1)}
          >
            Back
          </Button>
        ) : null}

        {last ? (
          <SubmitButton />
        ) : (
          <Button
            type="button"
            onClick={() => setStep((current) => current + 1)}
            disabled={blocked}
          >
            Next
          </Button>
        )}

        {blocked && !last ? (
          <p className="text-[11px] text-slate-500">
            This one is needed to build a challenge from.
          </p>
        ) : null}
      </div>
    </form>
  );
}
