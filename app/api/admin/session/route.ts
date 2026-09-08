import { env } from "@/lib/runtime";
import { createSession, endSession, rateLimit, requireAdmin, sessionCookie, verifyPassword } from "@/lib/admin-auth";
import { handleApi, HttpError, json, readJson, sameOrigin } from "@/lib/admin-http";

export const GET = handleApi(async request => { await requireAdmin(request); return json({ username: env.ADMIN_USERNAME }); });
export const POST = handleApi(async request => {
  sameOrigin(request);
  await rateLimit(request, "admin-login", 8);
  const body = await readJson(request) as { username?: unknown; password?: unknown };
  if (!body || typeof body.username !== "string" || typeof body.password !== "string" || body.password.length > 200)
    throw new HttpError(400, "Введите логин и пароль.");
  const valid = await verifyPassword(body.password);
  if (!valid || body.username !== env.ADMIN_USERNAME) throw new HttpError(401, "Неверный логин или пароль.");
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(request, await createSession()) });
});
export const DELETE = handleApi(async request => {
  sameOrigin(request);
  await endSession(request);
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(request, "", 0) });
});
