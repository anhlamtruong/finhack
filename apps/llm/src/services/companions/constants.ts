/**
 * Shared constants for pixel-art companion generation.
 */
export const PIXEL_STYLE =
  "16-bit pixel art, sprite sheet style, looping animation, high contrast, retro game style";

export const GREEN_SCREEN =
  "solid bright green background (#00FF00), chroma key green";

/**
 * Companion evolution stages used across generation + storage.
 */
export const STAGES = ["baby", "adult", "mythic"] as const;

/**
 * Mood ordering used for stage clip slicing.
 */
export const MOODS = ["idle", "happy", "sleepy", "hungry"] as const;

export const MOOD_ACTIONS: Record<(typeof MOODS)[number], string> = {
  idle: "stands calmly idle",
  happy: "jumps happily with a cheerful bounce",
  sleepy: "sways, blinks slowly, and falls asleep",
  hungry: "looks hungry with a small stomach rumble",
};
