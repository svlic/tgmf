import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { getSecretEnv } from "@/lib/env";
import type { AdminSessionPayload } from "@/lib/types";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const JWT_AUDIENCE = "tgmf-admin";
const JWT_ISSUER = "tgmf";

function getKeyMaterial() {
  return createHash("sha256").update(getSecretEnv().APP_ENCRYPTION_KEY).digest();
}

export function encryptString(plainText: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getKeyMaterial(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64url"), authTag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptString(payload: string) {
  const [ivPart, authTagPart, encryptedPart] = payload.split(".");
  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error("Invalid encrypted payload");
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getKeyMaterial(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export async function signAdminSession(payload: AdminSessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime("7d")
    .sign(getKeyMaterial());
}

export async function verifyAdminSession(token: string) {
  const result = await jwtVerify<AdminSessionPayload>(token, getKeyMaterial(), {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

  return result.payload;
}
