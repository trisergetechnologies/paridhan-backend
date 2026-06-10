import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const envPath = path.join(backendRoot, ".env");

const result = dotenv.config({ path: envPath });

if (result.error && process.env.NODE_ENV !== "test") {
  console.warn(`[env] Could not load ${envPath}:`, result.error.message);
}

export const envFilePath = envPath;

export const isGoogleOAuthConfigured = () => {
  const id = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  const secret = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
  return Boolean(id && secret);
};
