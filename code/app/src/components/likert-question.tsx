"use client";

import { cn } from "cn";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LIKERT_LABELS, type Question } from "@/lib/survey-types";

export function LikertQuestion({
  question,
  number,
  value,
  invalid,
  onChange,
}: {
  question: Question;
  number: number;
  value: number | undefined;
  invalid: boolean;
  onChange: (v: number) => void;
}) {
  const labelId = `q-${question.question_id}-label`;
  return (
    <div
      id={`q-${question.question_id}`}
      data-testid={`question-${question.question_id}`}
      className={cn(
        "scroll-mt-24 rounded-xl border bg-white p-4 transition-colors sm:p-5",
        invalid && "border-destructive/60 bg-destructive/5",
      )}
    >
      <p className="mb-1.5 text-xs font-medium tracking-wide text-brand-green uppercase">{question.theme}</p>
      <p id={labelId} className="text-[0.95rem] leading-relaxed font-medium text-foreground">
        <span className="mr-2 text-muted-foreground tabular-nums">{number}.</span>
        {question.question_text}
      </p>
      <RadioGroup
        aria-labelledby={labelId}
        aria-invalid={invalid || undefined}
        value={value === undefined ? null : String(value)}
        onValueChange={(v) => onChange(Number(v))}
        className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2"
      >
        {LIKERT_LABELS.map((label, i) => {
          const v = i + 1;
          const checked = value === v;
          return (
            <label
              key={v}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border bg-background px-1 py-2.5 text-center transition-all hover:border-brand-green/60 hover:bg-accent/60 sm:px-2 sm:py-3",
                checked && "border-brand-green bg-accent ring-1 ring-brand-green",
              )}
            >
              <RadioGroupItem value={String(v)} aria-label={label} className="data-checked:border-brand-green data-checked:bg-brand-green" />
              <span className={cn("text-sm font-semibold tabular-nums", checked ? "text-accent-foreground" : "text-foreground")}>{v}</span>
              <span className="text-[0.65rem] leading-tight text-muted-foreground sm:text-xs">{label}</span>
            </label>
          );
        })}
      </RadioGroup>
      {invalid && <p className="mt-2 text-sm text-destructive">Please choose an answer.</p>}
    </div>
  );
}
