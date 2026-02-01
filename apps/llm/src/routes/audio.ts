// apps/llm/src/routes/audio.ts
// Audio processing routes for voice-to-transaction feature.

import { Router, type Request, type Response } from "express";
import multer from "multer";
import { transcribeAudio, isSupportedAudioType, getSupportedFormatsMessage } from "../services/transcribe.js";
import { parseTransactionFromText, type ParsedTransaction } from "../services/transactionParser.js";

const ROUTE_NAME = "audio";

// Configure multer for memory storage with size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    if (isSupportedAudioType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}. ${getSupportedFormatsMessage()}`));
    }
  },
});

export const audioRouter = Router();

/**
 * POST /v1/audio/transcribe-and-parse
 *
 * Accepts an audio file, transcribes it using ElevenLabs STT,
 * then parses the text into a structured transaction object.
 *
 * Request: multipart/form-data with 'audio' field
 * Response: { ok: true, data: ParsedTransaction, transcription: string }
 */
audioRouter.post(
  "/transcribe-and-parse",
  upload.single("audio"),
  async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      // Validate file was uploaded
      if (!req.file) {
        return res.status(400).json({
          ok: false,
          error: "No audio file provided. Please upload an audio file in the 'audio' field.",
          supportedFormats: getSupportedFormatsMessage(),
        });
      }

      const { buffer, mimetype, originalname } = req.file;

      console.log(`[${ROUTE_NAME}] Processing audio file`, {
        originalname,
        mimetype,
        size: buffer.length,
        ts: new Date().toISOString(),
      });

      // Step 1: Transcribe audio to text
      const transcribeResult = await transcribeAudio(buffer, mimetype, originalname);

      if (!transcribeResult.text) {
        return res.status(422).json({
          ok: false,
          error: "Could not transcribe any speech from the audio. Please try again with clearer audio.",
          languageDetected: transcribeResult.languageCode,
        });
      }

      // Step 2: Parse transcription into transaction
      const parsed = await parseTransactionFromText(transcribeResult.text);

      const duration = Date.now() - startTime;

      console.log(`[${ROUTE_NAME}] Successfully processed audio`, {
        duration,
        transcriptionLength: transcribeResult.text.length,
        parsedAmount: parsed.amount,
        parsedPayee: parsed.payee,
        ts: new Date().toISOString(),
      });

      return res.json({
        ok: true,
        data: parsed,
        transcription: transcribeResult.text,
        languageCode: transcribeResult.languageCode,
        processingTimeMs: duration,
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const status = error?.status || 500;
      const message = error?.message || "Failed to process audio";

      console.error(`[${ROUTE_NAME}] Error processing audio`, {
        error: message,
        status,
        duration,
        ts: new Date().toISOString(),
      });

      return res.status(status).json({
        ok: false,
        error: message,
      });
    }
  },
);

/**
 * POST /v1/audio/transcribe
 *
 * Transcribe audio only (no parsing).
 * Useful for debugging or getting raw transcription.
 */
audioRouter.post(
  "/transcribe",
  upload.single("audio"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          ok: false,
          error: "No audio file provided.",
          supportedFormats: getSupportedFormatsMessage(),
        });
      }

      const { buffer, mimetype, originalname } = req.file;
      const result = await transcribeAudio(buffer, mimetype, originalname);

      return res.json({
        ok: true,
        text: result.text,
        languageCode: result.languageCode,
      });
    } catch (error: any) {
      return res.status(error?.status || 500).json({
        ok: false,
        error: error?.message || "Transcription failed",
      });
    }
  },
);

/**
 * GET /v1/audio/health
 *
 * Health check for audio service.
 */
audioRouter.get("/health", (_req: Request, res: Response) => {
  const hasElevenLabsKey = Boolean(process.env.ELEVENLABS_API_KEY);

  return res.json({
    ok: true,
    service: "audio",
    elevenlabs: {
      configured: hasElevenLabsKey,
    },
    supportedFormats: getSupportedFormatsMessage(),
  });
});

export default audioRouter;
