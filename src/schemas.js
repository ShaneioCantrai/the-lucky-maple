import { z } from 'zod';

export const contestEntrySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  province: z.string().trim().min(2).max(40),
  country: z.literal('CA').default('CA'),
  ageConfirmed: z.literal(true),
  rulesAccepted: z.literal(true),
  marketingConsent: z.boolean().default(false),
  entryMethod: z.enum(['free', 'purchase']).default('free'),
  orderId: z.string().uuid().optional(),
});

export const helpApplicationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  province: z.string().trim().min(2).max(40),
  category: z.string().trim().min(2).max(80),
  summary: z.string().trim().min(20).max(2500),
  requestedCents: z.number().int().positive().max(250_000),
  storyConsent: z.boolean().default(false),
});

export const mockPurchaseSchema = z.object({
  email: z.string().trim().email().max(254),
  leaves: z.array(z.object({
    displayName: z.string().trim().min(1).max(40),
    message: z.string().trim().max(120).optional().default(''),
    colour: z.enum(['red', 'orange', 'gold', 'green']).default('red'),
  })).min(1).max(100),
});
