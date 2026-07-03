import { ALLOWED_MEDIA_TYPES } from "@/lib/types";
import type { AllowedMediaType } from "@/lib/types";

export function normalizeAllowedMediaType(value: unknown): AllowedMediaType | null {
  if (typeof value !== "string") {
    return null;
  }
  if (ALLOWED_MEDIA_TYPES.includes(value as AllowedMediaType)) {
    return value as AllowedMediaType;
  }
  if (["video_note", "sticker", "animation"].includes(value)) {
    return "other";
  }

  return null;
}