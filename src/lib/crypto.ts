import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getAppEncryptionKey } from "@/lib/env";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";

function getKeyMaterial() {
  return createHash("sha256").update(getAppEncryptionKey()).digest();
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
