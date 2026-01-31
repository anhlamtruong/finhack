import { db } from "@/db";
import { companions, type CompanionPersonality } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

/**
 * Partial update schema for a companion's personality sub-field.
 */
const personalitySchema = z.object({
  tone: z.string().optional(),
  backstory: z.string().optional(),
  financialFocus: z.string().optional(),
});

/**
 * Update mutable companion fields (name/archetype/prompt/personality).
 */
export const updateCompanion = authedProcedure
  .input(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      archetype: z.string().min(1).optional(),
      prompt: z.string().optional().nullable(),
      personality: personalitySchema.optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type Tx = Parameters<typeof db.transaction>[0] extends (cb: infer T) => any
        ? T
        : never;

      const run = async <T>(fn: (client: typeof db | Tx) => Promise<T>) =>
        secureDb ? secureDb.rls(fn) : fn(db);

      const now = new Date();

      const updated = await run(async (client) => {
        const existingRows = await client
          .select()
          .from(companions)
          .where(
            and(
              eq(companions.id, input.id),
              eq(companions.userId, ctx.user.id),
            ),
          )
          .limit(1);

        const existing = existingRows[0];
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Companion not found" });
        }

        const nextPersonality: CompanionPersonality = input.personality
          ? {
              ...(existing.personality ?? { tone: "supportive", backstory: "" }),
              ...input.personality,
            }
          : (existing.personality as CompanionPersonality);

        const [row] = await client
          .update(companions)
          .set({
            name: input.name ?? existing.name,
            archetype: input.archetype ?? existing.archetype,
            prompt:
              input.prompt !== undefined ? input.prompt : existing.prompt,
            personality: nextPersonality,
            updatedAt: now,
          })
          .where(eq(companions.id, existing.id))
          .returning();

        return row;
      });

      return updated;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - updateCompanion. An unspecified error occurred: ${error}`,
      });
    }
  });
