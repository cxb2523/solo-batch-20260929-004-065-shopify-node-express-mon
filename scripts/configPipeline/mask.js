import crypto from "crypto";

/**
 * Mask a sensitive value: sha256 hex, first 8 chars.
 * Never returns the raw value.
 */
export function maskSecret(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 8);
}

/** Keys whose values must never be printed in clear. */
const SENSITIVE_PATTERN = /SECRET|PASSWORD|TOKEN|PRIVATE/i;

export function isSensitiveKey(key) {
  return SENSITIVE_PATTERN.test(key);
}

/** Display helper: masked for sensitive keys, raw otherwise. */
export function displayValue(key, value) {
  if (value === undefined || value === null) return "<missing>";
  if (isSensitiveKey(key)) return `sha256:${maskSecret(value)}`;
  return String(value);
}
