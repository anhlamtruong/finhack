import { db } from "@/db";
import {
  companionEvents,
  companions,
  CompanionVitals,
} from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import axios from "axios";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { fetchPageContextData } from "@/services/ai-agent/utils/page-context-mapper";

/**
 * XP rewards per interaction type.
 */
const XP_MAP = {
  login: 10,
  categorize: 5,
  budgetWin: 100,
  pet: 2,
  feed: 5,
  clean: 5,
} as const;

/**
 * Clamp a value between min and max.
 */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Convert XP into a level, minimum level 1.
 */
function levelFromXp(xp: number) {
  return Math.max(1, Math.floor(xp / 100) + 1);
}

/**
 * Convert level into an evolution stage.
 */
function stageFromLevel(level: number) {
  if (level >= 30) return "mythic" as const;
  if (level >= 10) return "adult" as const;
  return "baby" as const;
}

/**
 * Lightweight memory format passed to the LLM chat context.
 */
const memorySchema = z.object({
  event: z.string(),
  sentiment: z.string().optional(),
  note: z.string().optional(),
});

/**
 * Main interaction endpoint for companion state updates + LLM reply.
 *
 * Flow:
 * 1) Load or create companion.
 * 2) Update XP/vitals based on the action.
 * 3) Persist event + state changes.
 * 4) Call LLM chat with page context and return reply.
 */
export const companionInteract = authedProcedure
  .input(
    z.object({
      action: z.enum([
        "pet",
        "feed",
        "clean",
        "login",
        "categorize",
        "budgetWin",
      ]),
      companionId: z.string().optional(),
      message: z.string().optional(),
      pageContext: z
        .object({
          path: z.string(),
          params: z.record(z.string(), z.any()).optional(),
          dataSnapshot: z.any().optional(),
        })
        .optional(),
      context: z
        .object({
          safeToSpend: z.number().optional(),
          memories: z.array(memorySchema).optional(),
          personality: z.any().optional(),
          vitals: z
            .object({
              hunger: z.number().optional(),
              cleanliness: z.number().optional(),
              energy: z.number().optional(),
            })
            .optional(),
        })
        .optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const now = new Date();

    // LLM_URL is required for chat replies.
    const llmBase = process.env.LLM_URL;
    if (!llmBase) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "LLM_URL is not configured for companion interactions",
      });
    }

    try {
      const secureDb = ctx.secureDb;
      type Tx = Parameters<typeof db.transaction>[0] extends // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cb: infer T) => any ? T
        : never;

      const run = async <T>(fn: (client: typeof db | Tx) => Promise<T>) =>
        secureDb ? secureDb.rls(fn) : fn(db);

      // Update state and record the event atomically when possible.
      const { updated } = await run(async (client) => {
        const existing = input.companionId
          ? await client
            .select()
            .from(companions)
            .where(eq(companions.id, input.companionId))
            .limit(1)
          : await client
            .select()
            .from(companions)
            .where(eq(companions.userId, ctx.user.id))
            .limit(1);

        const current = existing[0] ? existing[0] : (
          await client
            .insert(companions)
            .values({
              id: uuidv4(),
              userId: ctx.user.id,
              name: ctx.user.firstName ?? "Chuchu",
              archetype: "guardian",
              evolutionStage: "baby",
              level: 1,
              xp: 0,
              vitals: {
                hunger: 0,
                cleanliness: 100,
                energy: 100,
                mood: "neutral",
              },
              lastInteractedAt: now,
            })
            .returning()
        )[0];

        const xpDelta = XP_MAP[input.action];
        const nextXp = (current.xp ?? 0) + xpDelta;
        const nextLevel = levelFromXp(nextXp);
        const nextStage = stageFromLevel(nextLevel);

        const baseVitals: CompanionVitals = {
          hunger: current.vitals?.hunger ?? current.hunger ?? 0,
          cleanliness: current.vitals?.cleanliness ?? current.cleanliness ??
            100,
          energy: current.vitals?.energy ?? current.energy ?? 100,
          mood: current.vitals?.mood ?? "neutral",
          lastDecayAt: current.vitals?.lastDecayAt ?? null,
        };

        const hungerDelta = input.action === "feed" ? -20 : 0;
        const cleanlinessDelta = input.action === "clean" ? 18 : 0;
        const energyDelta = input.action === "login"
          ? 10
          : input.action === "pet"
          ? 4
          : 0;

        const nextVitals: CompanionVitals = {
          hunger: clamp(
            (input.context?.vitals?.hunger ?? baseVitals.hunger) + hungerDelta,
            0,
            100,
          ),
          cleanliness: clamp(
            (input.context?.vitals?.cleanliness ?? baseVitals.cleanliness) +
              cleanlinessDelta,
            0,
            100,
          ),
          energy: clamp(
            (input.context?.vitals?.energy ?? baseVitals.energy) + energyDelta,
            0,
            100,
          ),
          mood: baseVitals.mood,
          lastDecayAt: now.toISOString(),
        };

        const [updatedCompanion] = await client
          .update(companions)
          .set({
            xp: nextXp,
            level: nextLevel,
            evolutionStage: nextStage,
            hunger: nextVitals.hunger,
            cleanliness: nextVitals.cleanliness,
            energy: nextVitals.energy,
            vitals: nextVitals,
            lastInteractedAt: now,
            updatedAt: now,
          })
          .where(eq(companions.id, current.id))
          .returning();

        await client.insert(companionEvents).values({
          id: uuidv4(),
          companionId: current.id,
          userId: ctx.user.id,
          action: input.action,
          xpDelta,
          hungerDelta,
          cleanlinessDelta,
          energyDelta,
          mood: nextVitals.mood ?? "neutral",
          payload: { reason: input.action, xpDelta },
          createdAt: now,
        });

        return { updated: updatedCompanion };
      });

      const prompt = input.message ??
        `You are interacting with ${updated.name}.`;

      let chatMessage = "";
      let animation = "idle";
      let summaryPayload: {
        summary: string;
        highlights: string[];
        risks: string[];
        suggests: string[];
        tone?: string;
      } | null = null;

      // Fetch page data when a path is provided without a snapshot.
      let dataSnapshot = input.pageContext?.dataSnapshot ?? null;
      if (input.pageContext && !dataSnapshot) {
        dataSnapshot = await fetchPageContextData(ctx.user.id, {
          path: input.pageContext.path,
          params: input.pageContext.params ?? {},
        });
      }

      try {
        const llmUrl = `${llmBase}/v1/companion/chat`;
        const llmResponse = await axios.post(
          llmUrl,
          {
            message: prompt,
            context: {
              safeToSpend: input.context?.safeToSpend,
              memories: input.context?.memories ?? [],
              personality: input.context?.personality ?? updated.personality,
              vitals: updated.vitals,
              currentScreen: input.pageContext
                ? {
                  route: input.pageContext.path,
                  data: dataSnapshot,
                }
                : undefined,
            },
          },
          { timeout: 60000 },
        );

        const summary = llmResponse.data?.summary ?? llmResponse.data?.reply;
        chatMessage = summary ?? "";
        animation = llmResponse.data?.animation ?? "idle";
        summaryPayload = {
          summary: summary ?? "",
          highlights: Array.isArray(llmResponse.data?.highlights)
            ? llmResponse.data.highlights
            : [],
          risks: Array.isArray(llmResponse.data?.risks)
            ? llmResponse.data.risks
            : [],
          suggests: Array.isArray(llmResponse.data?.suggests)
            ? llmResponse.data.suggests
            : [],
          tone: llmResponse.data?.tone,
        };
      } catch (llmErr) {
        console.warn("[companion] chat fallback", llmErr);
        chatMessage =
          "Thanks for checking in! Keep your savings on track and I'll feel better soon.";
        animation = flagsFromVitals(updated.vitals).isHungry
          ? "hungry"
          : "idle";
        summaryPayload = null;
      }

      return {
        status: "success",
        data: {
          companion: updated,
          xpDelta: XP_MAP[input.action],
          vitals: updated.vitals,
          reply: chatMessage,
          animation,
          summaryPayload,
        },
        message: "Interaction recorded",
      } as const;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Private Procedure Error - companionInteract. ${error}`,
      });
    }
  });

function flagsFromVitals(vitals: CompanionVitals | null | undefined) {
  if (!vitals) {
    return { isHungry: false, isDirty: false, isSleepy: false };
  }
  return {
    isHungry: vitals.hunger > 40,
    isDirty: vitals.cleanliness < 70,
    isSleepy: vitals.energy < 40,
  };
}
