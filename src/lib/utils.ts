import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { randomUUID } from "node:crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function nowIso() {
  return new Date().toISOString();
}

export function toInt(value: string | number) {
  return Number.parseInt(String(value), 10);
}

export function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

export function generateId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function redactSecret(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  if (value.length <= 4) {
    return "••••";
  }

  return `${value.slice(0, 2)}••••${value.slice(-2)}`;
}
