// Generate a Birdie access key for one person or group.
//   npm run key -- alice
// Prints the key to give to that person, and the entry to append to BIRDIE_ACCESS_KEYS.
import { randomBytes } from "node:crypto";

const name = process.argv[2];
if (!name || !/^[A-Za-z0-9_-]{1,40}$/.test(name)) {
  console.error("Usage: npm run key -- <name>   (letters, digits, - or _; e.g. alice, badminton-club)");
  process.exit(1);
}
// URL-safe base64: no ":" or "," so it fits the name:key,name:key format.
const key = randomBytes(32).toString("base64url");
console.log(`Key for ${name} (give this to them):\n  ${key}\n`);
console.log(`Append to BIRDIE_ACCESS_KEYS in Vercel (comma-separated):\n  ${name}:${key}`);
