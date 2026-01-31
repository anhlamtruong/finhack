# FFmpeg Production Hosting Guide (LLM Service)

## Overview
The LLM service uses FFmpeg to convert Veo-generated MP4s into GIFs for companion drafts. In production, ensure FFmpeg is installed and `FFMPEG_PATH` points to the binary.

## Option A: Docker (Recommended)
Add FFmpeg to the LLM Docker image.

Example (Debian/Ubuntu base):
```Dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
  && rm -rf /var/lib/apt/lists/*
ENV FFMPEG_PATH=/usr/bin/ffmpeg
```

Example (Alpine base):
```Dockerfile
RUN apk add --no-cache ffmpeg
ENV FFMPEG_PATH=/usr/bin/ffmpeg
```

## Option B: Host VM / Bare Metal
Install FFmpeg with your OS package manager:
- Ubuntu/Debian: `sudo apt-get update && sudo apt-get install -y ffmpeg`
- Amazon Linux: `sudo yum install -y ffmpeg`
- macOS (dev): `brew install ffmpeg`

Then set:
```
FFMPEG_PATH=/usr/bin/ffmpeg
```

## Verification
Run:
```
${FFMPEG_PATH} -version
```

## Notes
- Ensure the binary is readable and executable by the LLM process user.
- If you use a custom path, update `FFMPEG_PATH` in `.env`/runtime config.
- Keep FFmpeg updated to avoid codec issues with Veo outputs.

---

# Railway Hosting (LLM Service)

## Recommended: Dockerfile deployment
Railway supports Dockerfile-based builds. Add FFmpeg in the image and set env vars.

### Dockerfile snippet
```Dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
  && rm -rf /var/lib/apt/lists/*
ENV FFMPEG_PATH=/usr/bin/ffmpeg
```

### Railway Environment Variables
Set these in the Railway project settings (Variables tab):

```
PORT=8080
FFMPEG_PATH=/usr/bin/ffmpeg
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODEL=gemini-2.0-flash
VEO_MODEL_ID=veo-3.1-fast-generate-001
VEO_POLL_INTERVAL_MS=8000
VEO_POLL_MAX=45
LLM_PUBLIC_URL=https://<your-railway-service>.up.railway.app
CORS_ORIGINS=https://chuchube.co,https://www.chuchube.co
```

> If you use a different port, update both `PORT` and the Railway service config.

## Alternative: Nixpacks (no Dockerfile)
If you prefer Nixpacks, add FFmpeg as a package.

Create `nixpacks.toml` in `apps/llm`:
```toml
[phases.setup]
aptPkgs = ["ffmpeg"]
```

Then set:
```
FFMPEG_PATH=/usr/bin/ffmpeg
```

## Env file reference
Railway does not use `.env` files by default. You should set variables in the Railway UI.
For local parity, mirror these in `apps/llm/.env`.
