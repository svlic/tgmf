import { z } from "zod";
import { DEFAULT_DELAY_SECONDS } from "@/lib/constants";
import { ALLOWED_MEDIA_TYPES } from "@/lib/types";

export const loginSchema = z.object({
  password: z.string().min(1),
});

export const accountSchema = z.object({
  label: z.string().min(1).max(100),
  phoneNumber: z.string().min(3).max(32),
  apiIdOverride: z.string().trim().optional().or(z.literal("")),
  apiHashOverride: z.string().trim().optional().or(z.literal("")),
});

export const startLoginSchema = z.object({
  phoneNumber: z.string().min(3).max(32).optional(),
});

export const verifyCodeSchema = z.object({
  phoneCode: z.string().min(1).max(16),
});

export const verifyPasswordSchema = z.object({
  password: z.string().min(1).max(255),
});

export const jobSchema = z
  .object({
    accountId: z.string().min(1),
    sourceChannelRef: z.string().min(1),
    targetChannelRef: z.string().min(1),
    startMessageId: z.coerce.number().int().positive(),
    endMessageId: z.coerce.number().int().positive(),
    jobOrder: z.enum(["asc", "desc"]),
    mode: z.enum(["forward", "copy"]),
    albumStrategy: z.enum(["full_group", "captioned_only"]),
    allowedMediaTypes: z.array(z.enum(ALLOWED_MEDIA_TYPES)).default([]),
    delaySeconds: z.coerce.number().int().min(0).max(600).default(DEFAULT_DELAY_SECONDS),
  })
  .refine((value) => value.startMessageId <= value.endMessageId, {
    message: "startMessageId must be less than or equal to endMessageId",
    path: ["startMessageId"],
  });
