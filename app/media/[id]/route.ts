import { env } from "@/lib/runtime";
import { isAdmin } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/database";
import { handleApi, HttpError } from "@/lib/admin-http";

export const GET = handleApi(async request => {
  const id = new URL(request.url).pathname.split("/").pop() || "";
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id)) throw new HttpError(404, "Изображение не найдено.");
  const database = getDatabase();
  const published = await database.prepare("SELECT id FROM portfolio_projects WHERE published = 1 AND (desktop_image = ? OR mobile_image = ? OR EXISTS (SELECT 1 FROM json_each(COALESCE(desktop_images, '[]')) WHERE value = ?) OR EXISTS (SELECT 1 FROM json_each(COALESCE(mobile_images, '[]')) WHERE value = ?)) LIMIT 1").bind(`/media/${id}`, `/media/${id}`, `/media/${id}`, `/media/${id}`).first();
  if (!published && !await isAdmin(request)) throw new HttpError(404, "Изображение не найдено.");
  const metadata = await database.prepare("SELECT content_type FROM portfolio_images WHERE id = ?").bind(id).first<{ content_type: string }>();
  const object = metadata && await env.BUCKET?.get(id);
  if (!metadata || !object) throw new HttpError(404, "Изображение не найдено.");
  return new Response(object.body, { headers: {
    "Content-Type": metadata.content_type,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  } });
});
