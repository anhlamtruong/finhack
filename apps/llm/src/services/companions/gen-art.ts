import path from "node:path";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { MOODS, STAGES } from "./constants.js";
import { convertMp4ToGifSlice } from "./ffmpeg.js";
import { getBaseUrl, getPublicAssetsRoot } from "./paths.js";
import { generateStageVideo } from "./veo.js";

/**
 * Tiny placeholder asset used when VEO is unavailable.
 */
const PIXEL_PLACEHOLDER_GIF = Buffer.from(
  "R0lGODlhEAAQAPAAAP///wAAACH5BAAAAAAALAAAAAAQABAAAAIejI+py+0Po5y02ouz3rz7D4biSJbmiabqyrbuC8fyrYFADs=",
  "base64",
);


/**
 * Input arguments for draft asset generation.
 */
export type DraftAssetArgs = {
  userId: string;
  archetype: string;
  prompt?: string;
  visuals?: { primaryColor?: string; accentColor?: string; accessory?: string };
  baseUrl?: string;
};

/**
 * Output payload containing public URLs for each stage/mood.
 */
export type DraftAssetResult = {
  draftId: string;
  folderPath: string;
  assets: {
    baby: Record<string, string>;
    adult: Record<string, string>;
    mythic: Record<string, string>;
  };
};


/**
 * Generate draft assets for a companion by stage and mood.
 *
 * Flow:
 * 1) Request a stage clip from VEO.
 * 2) Slice into per-mood GIFs.
 * 3) Return public asset URLs.
 */
export async function generateDraftAssets(
  args: DraftAssetArgs,
): Promise<DraftAssetResult> {
  const draftId = randomUUID();
  const baseUrl = (args.baseUrl ?? getBaseUrl()).replace(/\/$/, "");
  const root = getPublicAssetsRoot();
  const folderPath = path.join(root, "companions", args.userId, draftId);
  const assets: DraftAssetResult["assets"] = {
    baby: {},
    adult: {},
    mythic: {},
  };
  const durationSeconds = Number(process.env.VEO_DURATION_SECONDS ?? 8);
  const segmentDuration = durationSeconds / MOODS.length;

  console.log("[llm][gen-art] draft generation start", {
    userId: args.userId,
    draftId,
    total: STAGES.length * MOODS.length,
  });

  for (const stage of STAGES) {
    console.log("[llm][gen-art] stage sequence start", { stage });
    const mp4Path = await generateStageVideo({
      prompt: `${args.prompt ?? ""} ${args.archetype}`.trim(),
      stage,
      visuals: args.visuals,
      durationSeconds,
    });

    for (let i = 0; i < MOODS.length; i += 1) {
      const mood = MOODS[i];
      const filename = `${stage}_${mood}.gif`;
      const filePath = path.join(folderPath, filename);
      const startTime = i * segmentDuration;

      console.log("[llm][gen-art] slicing", {
        stage,
        mood,
        startTime,
        duration: segmentDuration,
      });

      if (mp4Path) {
        await convertMp4ToGifSlice(mp4Path, filePath, startTime, segmentDuration);
      } else {
        // Fallback to a static placeholder if video generation fails.
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, PIXEL_PLACEHOLDER_GIF);
      }

      (assets as any)[stage][mood] =
        `${baseUrl}/assets/companions/${args.userId}/${draftId}/${filename}`;
      console.log("[llm][gen-art] saved", { stage, mood, filePath });
    }

    if (mp4Path) {
      fs.rm(mp4Path, { force: true }).catch(() => undefined);
    }
  }

  console.log("[llm][gen-art] draft generation complete", {
    userId: args.userId,
    draftId,
  });

  return {
    draftId,
    folderPath,
    assets,
  };
}
