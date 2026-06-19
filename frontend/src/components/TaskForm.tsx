"use client";

import { useState } from "react";

export interface TaskInput {
  task_type: "prompt" | "github";
  task_prompt: string;
  github_url?: string;
}

const EXAMPLES = [
  "Analyze the quarterly sales CSV and produce a trend report",
  "Train a sentiment classifier on the reviews dataset",
  "Scrape the docs site and build a search index",
];

export function TaskForm({ disabled, onSubmit }: { disabled?: boolean; onSubmit: (t: TaskInput) => void }) {
  const [type, setType] = useState<"prompt" | "github">("prompt");
  const [prompt, setPrompt] = useState("");
  const [github, setGithub] = useState("");

  const valid = type === "prompt" ? prompt.trim().length > 0 : /^https?:\/\/github\.com\/.+/.test(github.trim());

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit(
          type === "prompt"
            ? { task_type: "prompt", task_prompt: prompt.trim() }
            : { task_type: "github", task_prompt: `Process repository ${github.trim()}`, github_url: github.trim() }
        );
      }}
      className="card space-y-4"
    >
      <div className="inline-flex rounded-lg border border-edge p-1">
        {(["prompt", "github"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-md px-3 py-1.5 text-sm ${type === t ? "bg-brand text-white" : "text-muted"}`}
          >
            {t === "prompt" ? "Task prompt" : "GitHub URL"}
          </button>
        ))}
      </div>

      {type === "prompt" ? (
        <div>
          <textarea
            className="input min-h-[120px] resize-y"
            placeholder="Describe the task for the agent to plan and execute…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={disabled}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setPrompt(ex)}
                className="rounded-full border border-edge px-2.5 py-1 text-xs text-muted hover:border-brand hover:text-white"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <input
          className="input"
          placeholder="https://github.com/owner/repo"
          value={github}
          onChange={(e) => setGithub(e.target.value)}
          disabled={disabled}
        />
      )}

      <button type="submit" className="btn-primary w-full" disabled={disabled || !valid}>
        Submit task →
      </button>
    </form>
  );
}
