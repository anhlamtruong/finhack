import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

export type MascotStatus = "good" | "warn" | "danger" | "celebrate" | "neutral";

const MASCOT_STYLE = `Duolingo-like finance mascot (round baby chick), relaxed confident stance, small satisfied smile, warm eyes, subtle sparkle, holding a neat checklist and a coin jar, posture upright and composed, soft pastel gradient background, clean 2D vector, thick outline, minimal shading, friendly mobile UI illustration`;

function buildMotionPrompt(status: MascotStatus) {
  // Keep prompt short + specific, but always pin the character design to the reference image.
  switch (status) {
    case "good":
      return `Animate the SAME mascot from the reference image. Subtle happy idle: gentle bounce, blink, tiny head nod, soft sparkle twinkle, coin jar glints. Keep 2D vector look, thick outline, minimal shading.`;
    case "warn":
      return `Animate the SAME mascot from the reference image. Concerned-but-calm: small head tilt, slow blink, checklist taps once, subtle sigh motion. Keep 2D vector look, thick outline, minimal shading.`;
    case "danger":
      return `Animate the SAME mascot from the reference image. Slightly stressed: quick blink, tiny shake, checklist tremble, coin jar wobbles, then returns to calm. Keep 2D vector look, thick outline, minimal shading.`;
    case "celebrate":
      return `Animate the SAME mascot from the reference image. Celebration: small hop, confident smile grows, sparkle burst, checklist gets a checkmark, coin jar shine. Keep 2D vector look, thick outline, minimal shading.`;
    default:
      return `Animate the SAME mascot from the reference image. Neutral idle: blink, tiny breathing motion, subtle sparkle. Keep 2D vector look, thick outline, minimal shading.`;
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`[llm] Missing ${name}`);
  return v.trim();
}

/**
 * Generates a short mascot motion video (mp4) using Veo via the Gemini API.
 *
 * Notes:
 * - We intentionally guard optional SDK fields (operation.response, generatedVideos, etc.)
 *   to keep TypeScript happy and provide good runtime errors.
 */
export async function generateMascotVideo(opts: {
  status: MascotStatus;
  outDir: string; // where to save mp4
  outName?: string;
  durationSeconds?: number; // keep short for UI (prompt-based; not all SDK versions support this field)
  resolution?: "720p" | "1080p";
  mascotImagePath?: string;
}) {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const ai = new GoogleGenAI({ apiKey });

  const mascotPath =
    opts.mascotImagePath ?? path.join(process.cwd(), "apps/llm/assets/mascot.png");

  if (!fs.existsSync(mascotPath)) {
    throw new Error(`[llm] Mascot image not found at: ${mascotPath}`);
  }

  const imgBytes = fs.readFileSync(mascotPath).toString("base64");

  const prompt = [
    MASCOT_STYLE,
    buildMotionPrompt(opts.status),
    `Short looping-style clip (~6–8 seconds). No text overlays. No scene change. Keep background pastel gradient.`,
  ].join("\n");

  // Start generation
  // (SDK types vary across versions; keep the call shape stable and minimal.)
  let operation: any = await ai.models.generateVideos({
    model: "veo-3.1-generate-preview",
    prompt,
    image: {
      imageBytes: imgBytes,
      mimeType: "image/png",
    },
    config: {
      numberOfVideos: 1,
      resolution: opts.resolution ?? "720p",
    } as any,
  });

  // Poll until done with a timeout to avoid hanging forever.
  const pollEveryMs = Number(process.env.VEO_POLL_INTERVAL_MS ?? 10_000);
  const maxPolls = Number(process.env.VEO_POLL_MAX ?? 60); // ~10 minutes at 10s

  for (let i = 0; i < maxPolls; i++) {
    if (operation?.done) break;
    await sleep(pollEveryMs);
    operation = await ai.operations.getVideosOperation({ operation });
  }

  if (!operation?.done) {
    throw new Error(`[llm] Veo video generation timed out after ${maxPolls} polls`);
  }

  if (operation?.error) {
    const msg =
      operation?.error?.message ??
      (typeof operation?.error === "string" ? operation.error : "Veo operation failed");
    throw new Error(`[llm] Veo operation error: ${msg}`);
  }

  // Prepare output path
  fs.mkdirSync(opts.outDir, { recursive: true });
  const filename = opts.outName ?? `mascot_${opts.status}_${Date.now()}.mp4`;
  const fullPath = path.join(opts.outDir, filename);

  // Safely extract the downloadable file reference.
  const videoFile = operation?.response?.generatedVideos?.[0]?.video;
  if (!videoFile) {
    // Helpful debug slice (avoid dumping huge objects)
    const keys = Object.keys(operation ?? {});
    const respKeys = Object.keys(operation?.response ?? {});
    throw new Error(
      `[llm] Veo returned no video file. operation keys=${keys.join(",")} response keys=${respKeys.join(",")}`
    );
  }

  // Download the result
  await ai.files.download({
    file: videoFile as any,
    downloadPath: fullPath,
  });

  return { filename, fullPath, prompt };
}