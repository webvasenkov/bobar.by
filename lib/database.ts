import { env } from "@/lib/runtime";

/** Keep the runtime dependency at the server boundary. */
export function getDatabase() {
  if (!env.DB) throw new Error("Inquiry database binding is unavailable.");
  return env.DB;
}
