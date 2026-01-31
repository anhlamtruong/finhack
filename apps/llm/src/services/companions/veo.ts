import path from "node:path";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { buildStagePrompt, type DraftVisuals } from "./prompt.js";

/**
 * Generate a single stage-level Veo video that sequences all moods.
 * Returns a local MP4 path or null if generation failed.
 */
export async function generateStageVideo(args: {
  prompt: string;
  stage: string;
  visuals?: DraftVisuals;
  durationSeconds: number;
}) {
  const prompt = buildStagePrompt({
    description: args.prompt,
    stage: args.stage,
    visuals: args.visuals ?? {},
  });

  const modelId = process.env.VEO_MODEL_ID || "veo-3.1-fast-generate-preview";

  try {
    const apiKey = requireEnv("GEMINI_API_KEY");
    console.log(`GEMINI_API_KEY: ${apiKey}`);
    const ai = new GoogleGenAI({ apiKey });

    console.log("[llm][gen-art] veo request", {
      stage: args.stage,
      model: modelId,
      durationSeconds: args.durationSeconds,
    });

    let operation: any = await ai.models.generateVideos({
      model: modelId,
      prompt,
      config: {
        numberOfVideos: 1,
        durationSeconds: args.durationSeconds,
        resolution: "720p",
      } as any,
    });

    const pollEveryMs = Number(process.env.VEO_POLL_INTERVAL_MS ?? 8000);
    const maxPolls = Number(process.env.VEO_POLL_MAX ?? 45);
    for (let i = 0; i < maxPolls; i += 1) {
      if (operation?.done) break;
      await new Promise((r) => setTimeout(r, pollEveryMs));
      operation = await ai.operations.getVideosOperation({ operation });
    }

    if (!operation?.done) {
      throw new Error("Veo generation timed out");
    }

    if (operation?.error) {
      const msg =
        operation?.error?.message ||
        (typeof operation?.error === "string" ? operation.error : "Veo error");
      throw new Error(msg);
    }

    const videoFile = operation?.response?.generatedVideos?.[0]?.video;
    if (!videoFile) {
      throw new Error("Veo returned no video file");
    }

    const tmpDir = path.join(process.cwd(), ".tmp", "gen-art");
    await fs.mkdir(tmpDir, { recursive: true });
    const mp4Path = path.join(tmpDir, `${randomUUID()}.mp4`);

    await ai.files.download({ file: videoFile as any, downloadPath: mp4Path });
    return mp4Path;
  } catch (error) {
    console.warn("[llm][gen-art] veo failed, using placeholder", {
      stage: args.stage,
      model: modelId,
      message: (error as Error).message,
    });
    return null;
  }
}

/**
 * Ensure required env values exist.
 */
function requireEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`[llm] Missing ${name}`);
  return value.trim();
}
