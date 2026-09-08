import { env } from "@/lib/runtime";
import { notifyTelegram } from "@/lib/telegram";
import { inquiryRequestSchema } from "@/lib/inquiry";
import { getDatabase } from "@/lib/database";

const MAX_BODY_BYTES = 16_384;
const WINDOW_SECONDS = 3600;
const MAX_REQUESTS = 5;
const reply = (data: object, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

async function readLimitedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Empty body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("Body too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== (env.SITE_ORIGIN ?? new URL(request.url).origin))
    return reply({ error: "Недопустимый источник запроса." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    return reply({ error: "Неверный формат запроса." }, 415);
  let body: unknown;
  try {
    body = await readLimitedJson(request);
  } catch {
    return reply(
      { error: "Не удалось прочитать заявку. Проверьте данные." },
      400,
    );
  }
  const parsed = inquiryRequestSchema.safeParse(body);
  if (!parsed.success)
    return reply({ error: "Проверьте имя, контакт и описание проекта." }, 400);
  const { name, contact, message, requestId, website } = parsed.data;
  if (website) return reply({ error: "Не удалось отправить заявку." }, 400);
  try {
    const database = getDatabase();
    // A timed-out client can safely retry without creating a second inquiry.
    const existing = await database
      .prepare("SELECT id, name, contact, message FROM inquiries WHERE id = ?")
      .bind(requestId)
      .first<{ id: string; name: string; contact: string; message: string }>();
    if (existing)
      return existing.name === name &&
        existing.contact === contact &&
        existing.message === message
        ? reply({ ok: true })
        : reply(
            { error: "Обновите страницу перед отправкой новой заявки." },
            409,
          );
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / WINDOW_SECONDS);
    const address = request.headers.get(env.CLIENT_IP_HEADER ?? "cf-connecting-ip") ?? "unknown";
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${bucket}:${address}`),
    );
    const key = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    // Atomic upsert prevents parallel requests from bypassing the quota.
    const limit = await database
      .prepare(
        "INSERT INTO request_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count",
      )
      .bind(key, (bucket + 1) * WINDOW_SECONDS)
      .first<{ count: number }>();
    if (!limit || limit.count > MAX_REQUESTS)
      return reply(
        { error: "Слишком много заявок. Попробуйте через час." },
        429,
      );
    const [inserted] = await database.batch([
      database
        .prepare(
          "INSERT INTO inquiries (id, name, contact, message, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
        )
        .bind(requestId, name, contact, message, now),
      database
        .prepare("DELETE FROM request_limits WHERE expires_at < ?")
        .bind(now),
    ]);
    // Only the request that inserted the row sends a notification.
    if (inserted.meta.changes > 0) {
      const delivered = await notifyTelegram({ name, contact, message }, requestId, {
        token: env.TELEGRAM_BOT_TOKEN,
        chatId: env.TELEGRAM_CHAT_ID,
      });
      if (!delivered) console.error("Telegram notification not delivered", requestId);
    }
    return reply({ ok: true }, 201);
  } catch {
    console.error("Inquiry persistence failed");
    return reply(
      {
        error:
          "Не удалось сохранить заявку. Ваш текст остался в форме – попробуйте ещё раз.",
      },
      503,
    );
  }
}
