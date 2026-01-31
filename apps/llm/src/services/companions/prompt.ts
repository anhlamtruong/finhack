import { formatPrompt } from "../../utils/promptFormatter";
import { GREEN_SCREEN, MOODS, MOOD_ACTIONS, PIXEL_STYLE } from "./constants.js";

/**
 * Visual styling hints provided by the companion generator.
 */
export type DraftVisuals = {
  primaryColor?: string;
  accentColor?: string;
  accessory?: string;
};

/**
 * Prompt builder for stage-level Veo generation.
 * Produces a single continuous clip containing all moods.
 */
export function buildStagePrompt(args: {
  description: string;
  stage: string;
  visuals: DraftVisuals;
}) {
  return formatPrompt({
    role: "Pixel-art sprite animator",
    task: `Generate a single continuous ${args.stage} companion animation sequence that includes all moods in order.`,
    input: {
      description: args.description,
      stage: args.stage,
      visuals: args.visuals,
      // The LLM sees explicit mood -> action instructions.
      sequence: MOODS.map((mood) => `${mood}: ${MOOD_ACTIONS[mood]}`),
    },
    rules: [
      `Style: ${PIXEL_STYLE}.`,
      `STRICT Background: ${GREEN_SCREEN}.`,
      "STRICT 1:1 square aspect ratio only. No letterboxing or pillarboxing.",
      "Character palette must exclude bright green (#00FF00) so chroma key stays clean.",
      "Keep the subject centered with clean silhouette.",
      "Sequence order: idle → happy → sleepy → hungry (single continuous shot).",
    ],
    output: {
      format: "mp4",
      durationSeconds: Number(process.env.VEO_DURATION_SECONDS ?? 8),
      loop: false,
    },
  });
}
