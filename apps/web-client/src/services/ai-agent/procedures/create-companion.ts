/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/db";
import { CompanionAssets, companions } from "@/db/schema";
import {
  inferExtension,
  parseDataUrl,
  uploadToCompanionBucket,
} from "@/lib/supabase-upload";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

/**
 * Asset URLs per mood within a stage.
 */
const assetStageSchema = z.object({
  idle: z.string().min(1).nullish(),
  happy: z.string().min(1).nullish(),
  sleepy: z.string().min(1).nullish(),
  hungry: z.string().min(1).nullish(),
});

/**
 * Companion asset bundle by evolution stage.
 */
const assetsSchema = z.object({
  baby: assetStageSchema,
  adult: assetStageSchema,
  mythic: assetStageSchema,
});

/**
 * Optional personality config used at creation time.
 */
const personalitySchema = z.object({
  tone: z.string().default("supportive"),
  backstory: z.string().default(""),
  financialFocus: z.string().optional(),
});

/**
 * Persist a new companion, uploading any draft assets to Supabase storage.
 */
export const createCompanion = authedProcedure
  .input(
    z.object({
      name: z.string().min(1),
      archetype: z.string().default("guardian"),
      prompt: z.string().optional().nullable(),
      assets: assetsSchema,
      personality: personalitySchema.optional(),
      visuals: z
        .object({
          primaryColor: z.string().optional(),
          accentColor: z.string().optional(),
          accessory: z.string().optional(),
        })
        .optional(),
      evolutionStage: z.enum(["baby", "adult", "mythic"]).optional(),
      level: z.number().int().optional(),
      xp: z.number().int().optional(),
      vitals: z
        .object({
          hunger: z.number().optional(),
          cleanliness: z.number().optional(),
          energy: z.number().optional(),
          mood: z.string().optional(),
        })
        .optional(),
      dataHygiene: z
        .object({
          uncategorized: z.number().int().default(0),
          lastRefreshAt: z.string().nullable().optional(),
        })
        .optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Supabase env vars are missing",
      });
    }

    const companionId = randomUUID();
    const bucketPrefix = `${ctx.user.id}/${companionId}`;

    // Normalize asset inputs (data URL, remote URL, or local LLM asset path).
    const sanitizeAssets = async (assets: z.infer<typeof assetsSchema>) => {
      const stages: (keyof CompanionAssets)[] = ["baby", "adult", "mythic"];
      const moods: (keyof CompanionAssets["baby"])[] = [
        "idle",
        "happy",
        "sleepy",
        "hungry",
      ];
      const out: CompanionAssets = {
        baby: { idle: null, happy: null, sleepy: null, hungry: null },
        adult: { idle: null, happy: null, sleepy: null, hungry: null },
        mythic: { idle: null, happy: null, sleepy: null, hungry: null },
      };
      const cleanupTargets = new Set<string>();

      for (const stage of stages) {
        for (const mood of moods) {
          const source = assets?.[stage]?.[mood];
          if (!source) continue;

          const dataUrl = parseDataUrl(source as string);
          let buffer: Uint8Array;
          let contentType: string;

          if (dataUrl) {
            buffer = dataUrl.buffer;
            contentType = dataUrl.contentType;
          } else {
            const llmBase = process.env.LLM_URL?.replace(/\/$/, "");
            const normalized = String(source);
            const isHttp = /^https?:\/\//i.test(normalized);
            const isLocalAsset = normalized.startsWith("/") ||
              normalized.startsWith("_assets/");
            const fetchUrl = isHttp
              ? normalized
              : isLocalAsset
              ? llmBase ? `${llmBase}/${normalized.replace(/^\/?/, "")}` : null
              : null;

            if (!fetchUrl) {
              throw new Error(
                `Unsupported asset source (missing LLM_URL for local path): ${normalized}`,
              );
            }

            if (llmBase && fetchUrl.startsWith(llmBase)) {
              try {
                const url = new URL(fetchUrl);
                const pathParts = url.pathname.split("/").filter(Boolean);
                const assetsIndex = pathParts.indexOf("assets");
                if (assetsIndex >= 0 && pathParts.length > assetsIndex + 2) {
                  const cleanupPath = pathParts.slice(assetsIndex + 1, -1).join(
                    "/",
                  );
                  if (cleanupPath) cleanupTargets.add(cleanupPath);
                }
              } catch {
                // ignore cleanup parsing errors
              }
            }

            const res = await fetch(fetchUrl);
            if (!res.ok) {
              throw new Error(`Failed to fetch asset: ${source}`);
            }
            const arrayBuffer = await res.arrayBuffer();
            buffer = new Uint8Array(arrayBuffer);
            contentType = res.headers.get("content-type") ||
              "application/octet-stream";
          }

          const ext = inferExtension(contentType);
          const path = `${bucketPrefix}/${stage}-${mood}.${ext}`;
          const { publicUrl } = await uploadToCompanionBucket({
            path,
            data: buffer,
            contentType,
          });
          (out as any)[stage][mood] = publicUrl;
        }
      }

      return { assets: out, cleanupTargets };
    };

    try {
      const { assets: storedAssets, cleanupTargets } = await sanitizeAssets(
        input.assets,
      );
      const now = new Date();
      const baseVitals = {
        hunger: input.vitals?.hunger ?? 0,
        cleanliness: input.vitals?.cleanliness ?? 100,
        energy: input.vitals?.energy ?? 100,
        mood: input.vitals?.mood ?? "neutral",
        lastDecayAt: now.toISOString(),
      };

      const validStages = ["baby", "adult", "mythic"];
      const evolutionStage = validStages.includes(input.evolutionStage as string)
        ? (input.evolutionStage as "baby" | "adult" | "mythic")
        : "baby";
      const payload = {
        id: companionId,
        userId: ctx.user.id,
        name: input.name,
        archetype: input.archetype ?? "guardian",
        prompt: input.prompt ?? null,
        personality: {
          tone: input.personality?.tone ?? "supportive",
          backstory: input.personality?.backstory ?? "",
          financialFocus: input.personality?.financialFocus ?? "saving",
        },
        assets: storedAssets,
        evolutionStage,
        level: input.level ?? 1,
        xp: input.xp ?? 0,
        hunger: baseVitals.hunger,
        cleanliness: baseVitals.cleanliness,
        energy: baseVitals.energy,
        mood: baseVitals.mood,
        vitals: baseVitals,
        dataHygiene: input.dataHygiene ?? { uncategorized: 0 },
        lastInteractedAt: now,
        updatedAt: now,
      } satisfies typeof companions.$inferInsert;

      const secureDb = ctx.secureDb;
      type DbTx = Parameters<typeof db.transaction>[0] extends
        (tx: infer T) => any ? T : never;
      const runInsert = async (client: DbTx | typeof db) => {
        const [inserted] = await client.insert(companions).values(payload)
          .returning();
        return inserted;
      };

      const created = secureDb
        ? await secureDb.rls(runInsert)
        : await runInsert(db);

      const llmBase = process.env.LLM_URL?.replace(/\/$/, "");
      if (llmBase && cleanupTargets.size > 0) {
        for (const cleanupPath of cleanupTargets) {
          fetch(`${llmBase}/v1/companion/cleanup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: cleanupPath }),
          }).catch(() => undefined);
        }
      }

      return {
        status: "success",
        data: created,
        message: "Companion created",
      } as const;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `createCompanion failed: ${String(error)}`,
      });
    }
  });
