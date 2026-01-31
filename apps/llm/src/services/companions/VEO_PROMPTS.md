# Veo Prompt Structure (Companion Generation)

## Goal
Produce consistent, transparent pixel-art companion GIFs by generating a single stage-level video sequence and slicing it into mood-specific GIFs.

## Prompt Template
We use `formatPrompt` to construct a JSON-structured prompt:

- **Role:** Pixel-art sprite animator
- **Task:** Generate a single continuous stage animation sequence
- **Input (JSON):**
  - `description`: `${prompt} ${archetype}`
  - `stage`: `baby | adult | mythic`
  - `visuals`: `{ primaryColor, accentColor, accessory }`
  - `sequence`: ordered list of mood actions

## Style Enforcer
```
16-bit pixel art, sprite sheet style, looping animation, high contrast, retro game style
solid bright green background (#00FF00), chroma key green
```

## Sequence Order
The sequence is always:
1. idle — stands calmly idle
2. happy — jumps happily with a cheerful bounce
3. sleepy — sways, blinks slowly, and falls asleep
4. hungry — looks hungry with a small stomach rumble

## Output Expectations
- **Format:** MP4 (stage sequence)
- **Duration:** 8 seconds (default)
- **Aspect Ratio:** 1:1
- **Subject:** centered, clean silhouette for chroma key

## FFmpeg Split + Transparency
We slice the MP4 into 4 GIFs using chroma key:
```
-ss [start] -t [duration] -i [input] \
-filter_complex "fps=10,scale=320:-1:flags=neighbor,chromakey=0x00FF00:0.15:0.05,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
[output.gif]
```

## Notes
- If Veo returns shorter clips, reduce per-mood duration proportionally.
- If green screen bleeding occurs, adjust `chromakey` similarity/blend values.
