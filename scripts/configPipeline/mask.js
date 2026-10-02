import crypto from "crypto";

const SENSITIVE_PATTERN = /SECRET|TOKEN|PASSWORD|ENCRYPTION/i;

export const isSensitiveKey = (key) => SENSITIVE_PATTERN.test(key);

export const maskSecret = (value) => {
  if (typeof value !== "string" || value.length === 0) {
    return "sha256:00000000";
  }
  const digest = crypto.createHash("sha256").update(value).digest("hex");
  return `sha256:${digest.slice(0, 8)}`;
};

export const displayValue = (key, value) =>
  isSensitiveKey(key) ? maskSecret(value) : value;
