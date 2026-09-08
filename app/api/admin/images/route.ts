import { imageSize } from "image-size";
import { env } from "@/lib/runtime";
import { getDatabase } from "@/lib/database";
import { rateLimit, requireAdmin } from "@/lib/admin-auth";
import { handleApi, HttpError, json, readBytes, sameOrigin } from "@/lib/admin-http";

export const POST = handleApi(async request => {
  sameOrigin(request);
  await requireAdmin(request);
  await rateLimit(request, "admin-upload", 40);
  const bytes = await readBytes(request, 8 * 1024 * 1024);
  let dimensions;
  try { dimensions = imageSize(bytes); } catch { throw new HttpError(400, "Не удалось прочитать изображение."); }
  const types: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
  const contentType = types[dimensions.type || ""];
  if (!contentType) throw new HttpError(415, "Поддерживаются PNG, JPEG и WebP.");
  const { width, height } = dimensions;
  if (!width || !height || width > 8192 || height > 20000 || width * height > 40_000_000)
    throw new HttpError(400, "Изображение слишком большое. Максимум 40 мегапикселей.");
  if (!env.BUCKET) throw new HttpError(503, "Хранилище изображений ещё не подключено.");
  const id = crypto.randomUUID();
  await env.BUCKET.put(id, bytes.buffer as ArrayBuffer, { httpMetadata: { contentType } });
  try {
    await getDatabase().prepare("INSERT INTO portfolio_images (id, content_type, width, height, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(id, contentType, width, height, Date.now()).run();
  } catch (error) {
    await env.BUCKET.delete(id);
    throw error;
  }
  return json({ path: `/media/${id}`, width, height }, 201);
});
