import type { RunActivityUpdate } from "./execution.ts";

const short = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 100);

function failedAction(ongoing: string): string {
  const verbs: Record<string, string> = { Checking: "check", Running: "run", Building: "build", Searching: "search", Reading: "read", Updating: "update", Fetching: "fetch", Saving: "save", Creating: "create", Preparing: "prepare", Using: "use" };
  return `Failed to ${ongoing.replace(/^\w+/, verb => verbs[verb] ?? verb.toLowerCase())}`;
}

// Describe recorded actions. Never claim that a command achieved an unrecorded outcome.
function actionSummary(step: RunActivityUpdate): string {
  const title = step.title;
  let ongoing = "Using a tool";
  let completed = "Completed a tool action";
  if (/^(Checking memories for |Reading saved memories|Creating a worktree|Preparing the task worktree)/.test(title)) {
    ongoing = short(title);
    completed = ongoing.replace(/^Checking/, "Checked").replace(/^Reading/, "Read").replace(/^Creating/, "Created").replace(/^Preparing/, "Prepared");
  } else if (/^Read(?: |:)/.test(title)) {
    const path = short(title.replace(/^Read[: ]+/, ""));
    ongoing = `Reading ${path}`; completed = `Read ${path}`;
  } else if (/^(File changes|Edit:|Write:)/.test(title)) {
    ongoing = "Updating files"; completed = "Updated files";
  } else if (/^(Web search|WebSearch):/.test(title)) {
    const query = short(title.slice(title.indexOf(":") + 1));
    ongoing = `Searching the web for ${query}`; completed = `Searched the web for ${query}`;
  } else {
    // Ignore shell launch wrappers; match executable positions, not words inside search arguments.
    const command = title.replace(/^Bash:\s*/, "").replace(/^.*?\b(?:bash|zsh|sh)\s+-[lc]+\s+['"]/, "").replace(/^cd\s+(?:"[^"]*"|'[^']*'|\S+)\s*&&\s*/, "");
    const rules: [RegExp, string, string][] = [
      [/^(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?typecheck\b|^tsc\b/, "Checking types", "Checked types"],
      [/^(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test\b|^(?:node\s+.*--test|vitest|jest|pytest)\b/, "Running tests", "Ran tests"],
      [/^(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?lint\b|^eslint\b/, "Checking code style", "Checked code style"],
      [/^(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?build\b/, "Building the project", "Built the project"],
      [/^git\s+(?:diff|status|log|show)\b/, "Checking repository changes", "Checked repository changes"],
      [/^git\s+worktree\s+add\b/, "Creating a worktree", "Created a worktree"],
      [/^(?:rg|grep|find|Glob|Grep)\b/, "Searching files", "Searched files"],
      [/^(?:cat|sed|head|tail)\b/, "Reading files", "Read files"],
      [/^(?:python|python3)\b/, "Running a Python script", "Ran a Python script"],
      [/^(?:curl|wget)\b/, "Fetching a resource", "Fetched a resource"],
      [/^git\s+commit\b/, "Saving a commit", "Saved a commit"],
      [/^apply_patch\b/, "Updating files", "Updated files"],
      [/^(?:ls|pwd)\b/, "Checking the workspace", "Checked the workspace"],
    ];
    const rule = rules.find(([pattern]) => pattern.test(command));
    if (rule) [, ongoing, completed] = rule;
    const search = command.match(/^(?:rg|grep)\s+(?:-(?:n|i|l|r|R|w|F|e)\s+)*(?:"([^"]+)"|'([^']+)'|([^\s-][^\s]*))/);
    if (search) {
      const query = short(search[1] ?? search[2] ?? search[3]);
      ongoing = `Searching files for ${query}`; completed = `Searched files for ${query}`;
    }
  }
  if (step.status === "error") return failedAction(ongoing);
  if (step.status === "interrupted") return `${ongoing} — interrupted`;
  return step.status === "complete" ? completed : ongoing;
}

export type ActivityLabel = { before: string; names?: string[]; after?: string };

function readFiles(title: string): string[] {
  const command = title.replace(/^Bash:\s*/, "").replace(/^(?:.*\/)?(?:bash|zsh|sh)\s+-[lc]+\s+(['"])([\s\S]*)\1$/, "$2");
  const tokens = command.match(/"[^"\n]*"|'[^'\n]*'|[^\s;&|<>]+|[;&|<>]+/g) ?? [];
  const executable = tokens.shift()?.split("/").at(-1);
  if (!["cat", "head", "tail", "sed"].includes(executable ?? "")) return [];
  const paths: string[] = [];
  let script = executable === "sed";
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (/^(?:[;&|<>]|&&|\|\|)/.test(token)) break;
    if (executable !== "sed" && ["-n", "-c", "--lines", "--bytes"].includes(token)) { index++; continue; }
    if (token.startsWith("-")) continue;
    if (script) { script = false; continue; }
    const path = token.replace(/^(['"])(.*)\1$/, "$2");
    if (path && !/[$`*?]/.test(path)) paths.push(path);
  }
  return paths;
}

export function activityLabel(step: RunActivityUpdate): ActivityLabel {
  const files = step.filePath ? [step.filePath] : /^Read(?: |:)/.test(step.title)
    ? [step.title.replace(/^Read[: ]+/, "")] : readFiles(step.title);
  if (files.length) return {
    before: step.status === "complete" ? "Read " : step.status === "error" ? "Failed to read " : step.status === "interrupted" ? "Stopped reading " : "Reading ",
    names: files,
  };
  const qualifiedTool = step.title.match(/^([\w.-]+): ([\w.-]+)$/);
  const tool = qualifiedTool && (!step.toolName || step.toolName === qualifiedTool[2])
    ? `${qualifiedTool[1]}.${qualifiedTool[2]}` : step.toolName;
  const action = actionSummary(step);
  if (tool) {
    if (/^(Using a tool|Completed a tool action|Failed to use a tool)/.test(action)) return {
      before: step.status === "complete" ? "Used " : step.status === "error" ? "Failed to use " : step.status === "interrupted" ? "Stopped using " : "Using ",
      names: [tool], after: " tool",
    };
    return { before: `${action} · `, names: [tool], after: " tool" };
  }
  return { before: action };
}

export function activitySummary(step: RunActivityUpdate): string {
  const label = activityLabel(step);
  return label.before + (label.names?.map(name => `\`${name}\``).join(", ") ?? "") + (label.after ?? "");
}
