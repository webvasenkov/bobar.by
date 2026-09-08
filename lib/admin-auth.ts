import { env } from "@/lib/runtime";
import { getDatabase } from "./database";
import { HttpError } from "./admin-http";

const COOKIE = "bobar_admin";
const SESSION_SECONDS = 12 * 60 * 60;
const hex = (bytes: Uint8Array) => [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
export const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const hash = async (value: string) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));

export async function verifyPassword(password: string) {
  const config = env.ADMIN_PASSWORD_HASH || "";
  const [algorithm, iterations, salt, expected] = config.split(":");
  if (algorithm !== "pbkdf2" || iterations !== "100000" || !/^[a-f0-9]{32}$/.test(salt || "") || !/^[a-f0-9]{64}$/.test(expected || ""))
    throw new HttpError(503, "Вход ещё не настроен на сервере.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const result = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", iterations: 100000,
    salt: Uint8Array.from(salt.match(/../g)!, byte => parseInt(byte, 16)) }, key, 256);
  const actual = hex(new Uint8Array(result));
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

export async function rateLimit(request: Request, scope: string, maximum: number, seconds = 900) {
  const now = Math.floor(Date.now() / 1000);
  const address = request.headers.get(env.CLIENT_IP_HEADER || "cf-connecting-ip") || "unknown";
  const key = `${scope}:${await hash(address + ':' + Math.floor(now / seconds))}`;
  const database = getDatabase();
  const result = await database.prepare("INSERT INTO request_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count")
    .bind(key, now + seconds).first<{ count: number }>();
  if (!result || result.count > maximum) throw new HttpError(429, "Слишком много попыток. Попробуйте позже.");
  await database.prepare("DELETE FROM request_limits WHERE expires_at < ?").bind(now).run();
}

function tokenFrom(request: Request) {
  return request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1) || "";
}

export async function isAdmin(request: Request) {
  const token = tokenFrom(request);
  if (!env.ADMIN_PASSWORD_HASH || !/^[a-f0-9]{64}$/.test(token)) return false;
  const session = await getDatabase().prepare("SELECT expires_at, credential_hash FROM admin_sessions WHERE token_hash = ?")
    .bind(await hash(token)).first<{ expires_at: number; credential_hash: string }>();
  return !!session && session.expires_at > Date.now() / 1000 && session.credential_hash === await hash(env.ADMIN_PASSWORD_HASH);
}

export async function requireAdmin(request: Request) {
  if (!await isAdmin(request)) throw new HttpError(401, "Войдите в админку.");
}

export function sessionCookie(request: Request, token: string, maxAge = SESSION_SECONDS) {
  const secure = new URL(env.SITE_ORIGIN || request.url).protocol === "https:";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export async function createSession() {
  const token = randomToken();
  const now = Math.floor(Date.now() / 1000);
  const database = getDatabase();
  await database.batch([
    database.prepare("DELETE FROM admin_sessions WHERE expires_at < ?").bind(now),
    database.prepare("INSERT INTO admin_sessions (token_hash, credential_hash, expires_at) VALUES (?, ?, ?)")
      .bind(await hash(token), await hash(env.ADMIN_PASSWORD_HASH!), now + SESSION_SECONDS),
  ]);
  return token;
}

export async function endSession(request: Request) {
  await getDatabase().prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(await hash(tokenFrom(request))).run();
}
