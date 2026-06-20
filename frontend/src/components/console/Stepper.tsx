import { ReactNode } from "react";

export type StepStatus = "done" | "current" | "upcoming";

export interface Step {
  label: string;
  description?: ReactNode;
  status: StepStatus;
}

export function Stepper({
  steps,
  orientation = "horizontal",
}: {
  steps: Step[];
  orientation?: "horizontal" | "vertical";
}) {
  return orientation === "horizontal" ? <HStepper steps={steps} /> : <VStepper steps={steps} />;
}

function dotClasses(status: StepStatus) {
  if (status === "done") return "border-teal bg-teal text-white";
  if (status === "current") return "border-terracotta bg-terracotta text-white";
  return "border-line bg-white text-ink-faint";
}

function connector(done: boolean) {
  return done ? "bg-teal" : "bg-line";
}

function Dot({ status, n }: { status: StepStatus; n: number }) {
  return (
    <span
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold ${dotClasses(status)}`}
    >
      {status === "done" ? "✓" : n}
    </span>
  );
}

function HStepper({ steps }: { steps: Step[] }) {
  return (
    <div className="flex items-start">
      {steps.map((s, i) => (
        <div key={i} className="flex flex-1 flex-col items-center text-center">
          <div className="flex w-full items-center">
            <span className={`h-px flex-1 ${i === 0 ? "bg-transparent" : connector(steps[i - 1].status === "done")}`} />
            <Dot status={s.status} n={i + 1} />
            <span className={`h-px flex-1 ${i === steps.length - 1 ? "bg-transparent" : connector(s.status === "done")}`} />
          </div>
          <span
            className={`mt-2 max-w-[8rem] text-[11px] font-medium uppercase tracking-wide ${
              s.status === "upcoming" ? "text-ink-faint" : "text-ink"
            }`}
          >
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function VStepper({ steps }: { steps: Step[] }) {
  return (
    <ol>
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <Dot status={s.status} n={i + 1} />
            {i < steps.length - 1 && <span className={`my-1 w-px flex-1 ${connector(s.status === "done")}`} />}
          </div>
          <div className={`pb-6 ${s.status === "upcoming" ? "opacity-60" : ""}`}>
            <p className={`text-sm font-semibold ${s.status === "current" ? "text-terracotta" : "text-ink"}`}>
              {s.label}
            </p>
            {s.description && <p className="mt-0.5 text-[13px] text-ink-soft">{s.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
