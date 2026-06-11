import { z } from "zod"

export const JobParamsSchema = {
  newsroom_cycle: z.object({}).strict(),

  rag_reindex: z
    .object({
      mode: z.enum(["missing", "recent", "article", "all"]),
      limit: z.number().int().min(1).max(100).optional(),
      articleId: z.string().cuid().optional(),
    })
    .strict(),

  ai_batch: z
    .object({
      task: z.enum(["sentiment", "tag", "summarize", "all"]),
      limit: z.number().int().min(1).max(50),
      topic: z.string().min(1).max(80).optional(),
    })
    .strict(),

  digest_generate: z
    .object({
      regen: z.boolean().optional(),
    })
    .strict(),
}

export type JobType = keyof typeof JobParamsSchema
export type JobParams = z.infer<(typeof JobParamsSchema)[JobType]>

export function validateJobParams(
  type: JobType,
  params: unknown
): { success: true; data: Record<string, unknown> } | { success: false; error: string } {
  const schema = JobParamsSchema[type]
  if (!schema) return { success: false, error: "Unknown job type" }

  const result = schema.safeParse(params)
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((issue) => issue.message).join(", "),
    }
  }

  return { success: true, data: result.data as Record<string, unknown> }
}
