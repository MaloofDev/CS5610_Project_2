import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/**
 * Hashes a password with scrypt and a new random salt.
 * @param {string} password
 * @returns {Promise<{ passwordHash: string, salt: string }>} hex strings to store on the user
 */
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return { passwordHash: key.toString("hex"), salt };
}

/**
 * @param {string} password
 * @param {{ passwordHash: string, salt: string }} user
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, { passwordHash, salt }) {
  const attempt = await scryptAsync(password, salt, KEY_LENGTH);
  const stored = Buffer.from(passwordHash, "hex");
  return attempt.length === stored.length && timingSafeEqual(attempt, stored);
}
