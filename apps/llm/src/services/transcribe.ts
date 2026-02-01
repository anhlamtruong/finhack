// apps/llm/src/services/transcribe.ts
// ElevenLabs Speech-to-Text service for transcribing audio files.

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

// Supported MIME types for audio transcription
const SUPPORTED_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
] as const;

type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

/**
 * Check if a MIME type is supported for transcription.
 */
export function isSupportedAudioType(mimeType: string): mimeType is SupportedMimeType {
  return SUPPORTED_MIME_TYPES.includes(mimeType as SupportedMimeType);
}

/**
 * Get a user-friendly list of supported audio formats.
 */
export function getSupportedFormatsMessage(): string {
  return "Supported formats: MP3, WAV, WebM, OGG";
}

// Lazy-init client to avoid throwing at import time if env is missing
let _client: ElevenLabsClient | null = null;

function getClient(): ElevenLabsClient {
  if (_client) return _client;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ELEVENLABS_API_KEY environment variable");
  }

  _client = new ElevenLabsClient({ apiKey });
  return _client;
}

export type TranscribeResult = {
  text: string;
  languageCode?: string;
};

/**
 * Transcribe audio buffer to text using ElevenLabs Speech-to-Text.
 *
 * @param audioBuffer - The audio file as a Buffer
 * @param mimeType - The MIME type of the audio file
 * @param fileName - Optional filename for the audio (defaults to audio.webm)
 * @returns Promise resolving to the transcribed text
 * @throws Error if MIME type is unsupported or transcription fails
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  fileName?: string,
): Promise<TranscribeResult> {
  // Validate MIME type
  if (!isSupportedAudioType(mimeType)) {
    throw new Error(
      `Unsupported audio format: ${mimeType}. ${getSupportedFormatsMessage()}`,
    );
  }

  const client = getClient();

  // Determine file extension from MIME type
  const extMap: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
  };
  const ext = extMap[mimeType] || "webm";
  const resolvedFileName = fileName || `audio.${ext}`;

  console.log("[transcribe] Starting transcription", {
    mimeType,
    fileName: resolvedFileName,
    bufferSize: audioBuffer.length,
    ts: new Date().toISOString(),
  });

  try {
    // Create a File object from the buffer for the ElevenLabs SDK
    // Use Uint8Array to avoid Buffer type compatibility issues
    const uint8Array = new Uint8Array(audioBuffer);
    const audioBlob = new Blob([uint8Array], { type: mimeType });
    const audioFile = new File([audioBlob], resolvedFileName, { type: mimeType });

    // Use the ElevenLabs Speech-to-Text API
    const result = await client.speechToText.convert({
      file: audioFile,
      modelId: "scribe_v1", // ElevenLabs' latest STT model
    });

    // Handle both single-channel and multi-channel responses
    let text = "";
    let languageCode: string | undefined;

    // Check if it's a single channel response (has 'text' property directly)
    if ("text" in result && typeof result.text === "string") {
      text = result.text.trim();
      languageCode = (result as any).languageCode;
    } 
    // Multi-channel response has 'transcripts' array
    else if ("transcripts" in result && Array.isArray((result as any).transcripts)) {
      const transcripts = (result as any).transcripts;
      if (transcripts.length > 0) {
        text = transcripts.map((t: any) => t.text || "").join(" ").trim();
        languageCode = transcripts[0]?.languageCode;
      }
    }

    console.log("[transcribe] Transcription complete", {
      textLength: text.length,
      languageCode,
      ts: new Date().toISOString(),
    });

    return {
      text,
      languageCode,
    };
  } catch (error: any) {
    console.error("[transcribe] Transcription failed", {
      error: error?.message || error,
      status: error?.status,
      ts: new Date().toISOString(),
    });

    // Re-throw with more context
    const message = error?.message || "Unknown transcription error";
    const wrappedError: any = new Error(`Transcription failed: ${message}`);
    wrappedError.status = error?.status || 500;
    wrappedError.cause = error;
    throw wrappedError;
  }
}
