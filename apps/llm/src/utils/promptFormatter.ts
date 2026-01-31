/**
 * Input shape for building structured LLM prompts.
 */
type PromptFormatterArgs = {
  role: string;
  task: string;
  rules: string[];
  input: Record<string, unknown>;
  output: Record<string, unknown> | string;
  context?: Record<string, unknown>;
};

/**
 * Pretty-print JSON for prompt readability.
 */
function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

/**
 * Formats a deterministic prompt with role, task, input, rules, and output.
 */
export function formatPrompt({
  role,
  task,
  rules,
  input,
  output,
  context,
}: PromptFormatterArgs) {
  const sections = [
    `Role: ${role}`,
    `Task: ${task}`,
    "",
    "Input (JSON):",
    prettyJson(input),
  ];

  if (context && Object.keys(context).length > 0) {
    sections.push("", "Context (JSON):", prettyJson(context));
  }

  if (rules.length > 0) {
    sections.push("", "Rules:", ...rules.map((rule) => `- ${rule}`));
  }

  sections.push(
    "",
    "Output (JSON):",
    typeof output === "string" ? output : prettyJson(output),
  );

  return sections.join("\n").trim();
}
