import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";

/**
 * Convert a slice of an MP4 into a transparent GIF using chroma key.
 * Uses the green screen color from prompt rules.
 */
export async function convertMp4ToGifSlice(
  mp4Path: string,
  gifPath: string,
  startTime: number,
  duration: number,
) {
  // Allow custom ffmpeg path in production containers.
  const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
  await fs.mkdir(path.dirname(gifPath), { recursive: true });
  return new Promise<void>((resolve, reject) => {
    execFile(
      ffmpegPath,
      [
        "-y",
        "-ss",
        startTime.toFixed(2),
        "-t",
        duration.toFixed(2),
        "-i",
        mp4Path,
        "-filter_complex",
        "fps=10,scale=320:320:flags=neighbor,setsar=1,chromakey=0x00FF00:0.15:0.05,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
        gifPath,
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });
}
