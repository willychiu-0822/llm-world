import { z } from "zod";
import { ACCESSORIES, BODY_SHAPES } from "./appearance";
import { DISTRICT_KEYS } from "./districts";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const id = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().min(1).max(max);

export const districtKey = z.enum(DISTRICT_KEYS);

export const appearanceSchema = z.object({
  body: z.enum(BODY_SHAPES),
  accessory: z.enum(ACCESSORIES),
  main: hex,
  accent: hex,
  description: z.string().trim().max(120).default(""),
});

export const characterInput = z.object({
  name: text(20),
  appearance: appearanceSchema,
  personality: z.string().trim().max(200).default(""),
  sharing: z.object({ allowAiQuotes: z.boolean() }).default({ allowAiQuotes: true }),
});

export const wantInput = z.object({ text: text(100), districtKey });
export const wantUpdate = z.object({ text: text(100).optional(), districtKey: districtKey.optional(), status: z.enum(["active", "done", "dropped"]).optional() });

export const executor = z.enum(["ai", "self"]);

export const firstStepInput = z.object({
  executor,
  text: text(200),
  wantId: id.optional(),
  sourceDeedIds: z.array(id).max(5).default([]),
  trialId: id.optional(),
  sessionId: id.optional(),
  plannedAt: z.string().datetime({ offset: true }).optional(),
  where: z.string().trim().max(100).optional(),
  noteBefore: z.string().trim().max(2000).optional(),
});

export const completeStepInput = z.object({
  noteAfter: z.string().trim().max(2000).optional(),
  noteShared: z.boolean().default(false),
  visibility: z.enum(["public", "private"]).default("public"),
});

export const noteInput = z.object({ body: z.string().trim().max(2000), shared: z.boolean().default(false) });

export const deedVisibilityInput = z.object({ visibility: z.enum(["public", "private"]) });

export const providerApplyInput = z.object({ name: text(40), description: z.string().trim().max(500).default("") });

export const shopInput = z.object({
  districtKey,
  name: text(30),
  description: z.string().trim().max(300).default(""),
  roofColor: hex.default("#E8B4A0"),
  realAddress: z.string().trim().max(200).optional(),
  online: z.boolean().default(false),
});

export const trialInput = z.object({
  placeId: id,
  title: text(60),
  description: z.string().trim().max(1000).default(""),
  durationMin: z.number().int().min(10).max(480),
  exitAnytime: z.boolean().default(true),
  buddyOk: z.boolean().default(true),
  whenText: z.string().trim().max(100).default(""),
  processInfo: z.string().trim().max(2000).default(""),
  aiFirstStepHint: z.string().trim().max(200).default(""),
  selfFirstStepHint: z.string().trim().max(200).default(""),
});

export const faqInput = z.object({ question: text(200), answer: text(1000) });
export const sessionInput = z.object({ startsAt: z.string().datetime({ offset: true }), capacity: z.number().int().min(1).max(500).default(20) });
export const answerInput = z.object({ answer: text(1000), addToFaq: z.boolean().default(true) });

export const discoveryItem = z.object({ type: z.enum(["deed", "trial", "place"]), id });
export const bringBackInput = z.object({ message: text(1000), items: z.array(discoveryItem).min(1).max(10) });
export const providerAskInput = z.object({ trialId: id, question: text(300) });
export const aiCompleteInput = z.object({ stepId: id, result: text(2000) });
export const reviewStepInput = z.object({
  decision: z.enum(["approve", "reject"]),
  result: z.string().trim().max(2000).optional(),
  visibility: z.enum(["public", "private"]).optional(),
});
export const aiProposeInput = z.object({
  executor,
  text: text(200),
  wantId: id.optional(),
  sourceDeedIds: z.array(id).max(5).default([]),
  trialId: id.optional(),
  reason: z.string().trim().max(500).optional(),
});

export type CharacterInput = z.infer<typeof characterInput>;
export type FirstStepInput = z.infer<typeof firstStepInput>;
