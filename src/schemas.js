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

export const applicantCredentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
});

export const helpApplicationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  province: z.string().trim().min(2).max(40),
  city: z.string().trim().max(120).optional().default(''),
  preferredContact: z.enum(['email', 'phone', 'either']).default('email'),
  phone: z.string().trim().max(40).optional().default(''),
  category: z.string().trim().min(2).max(80),
  summary: z.string().trim().min(10).max(1200),
  privateStory: z.string().trim().min(20).max(8000),
  publicStoryDraft: z.string().trim().max(3000).optional().default(''),
  publicIdentityPreference: z.enum(['full_name','first_name','pseudonym','anonymous']).default('first_name'),
  publicAlias: z.string().trim().max(80).optional().default(''),
  requestedCents: z.number().int().positive().max(5_000_000),
  openToPublicStory: z.boolean().default(false),
  eligibilityConfirmed: z.boolean().default(false),
  accuracyConfirmed: z.boolean().default(false),
  privacyAcknowledged: z.boolean().default(false),
});

export const helpApplicationDraftSchema = z.object({
  name: z.string().trim().max(120).optional().default(''),
  province: z.string().trim().max(40).optional().default(''),
  city: z.string().trim().max(120).optional().default(''),
  preferredContact: z.enum(['email', 'phone', 'either']).default('email'),
  phone: z.string().trim().max(40).optional().default(''),
  category: z.string().trim().max(80).optional().default(''),
  summary: z.string().trim().max(1200).optional().default(''),
  privateStory: z.string().trim().max(8000).optional().default(''),
  publicStoryDraft: z.string().trim().max(3000).optional().default(''),
  publicIdentityPreference: z.enum(['full_name','first_name','pseudonym','anonymous']).default('first_name'),
  publicAlias: z.string().trim().max(80).optional().default(''),
  requestedCents: z.number().int().min(0).max(5_000_000).default(0),
  openToPublicStory: z.boolean().default(false),
  eligibilityConfirmed: z.boolean().default(false),
  accuracyConfirmed: z.boolean().default(false),
  privacyAcknowledged: z.boolean().default(false),
});

export const mockPurchaseSchema = z.object({
  email: z.string().trim().email().max(254),
  leaves: z.array(z.object({
    displayName: z.string().trim().min(1).max(40),
    message: z.string().trim().max(120).optional().default(''),
    colour: z.enum(['red', 'orange', 'gold', 'green']).default('red'),
  })).min(1).max(100),
});
