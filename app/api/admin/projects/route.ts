import { requireAdmin } from "@/lib/admin-auth";
import { handleApi, json, readJson, sameOrigin, HttpError } from "@/lib/admin-http";
import { listProjects, saveProject } from "@/lib/projects";
import { getDatabase } from "@/lib/database";
import { z } from "zod";

export const GET = handleApi(async request => { await requireAdmin(request); return json(await listProjects(true)); });
export const PUT = handleApi(async request => { sameOrigin(request); await requireAdmin(request); await saveProject(await readJson(request)); return json(await listProjects(true)); });

const changeSchema = z.object({ id: z.string().uuid(), version: z.number().int().min(1), published: z.boolean().optional(), direction: z.enum(["up", "down"]).optional() });
export const PATCH = handleApi(async request => {
  sameOrigin(request); await requireAdmin(request);
  const parsed = changeSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Неверные параметры.");
  const data = parsed.data;
  const projects = await listProjects(true);
  const index = projects.findIndex(project => project.id === data.id);
  const project = projects[index];
  if (!project || project.version !== data.version) throw new HttpError(409, "Список изменился. Обновите страницу.");
  const database = getDatabase();
  if (data.direction) {
    const other = projects[index + (data.direction === "up" ? -1 : 1)];
    if (!other) return json(projects);
    // A single statement swaps both rows atomically and rejects stale versions.
    const result = await database.prepare("UPDATE portfolio_projects SET position = CASE WHEN id = ? THEN ? ELSE ? END, version = version + 1, updated_at = ? WHERE id IN (?, ?) AND (SELECT COUNT(*) FROM portfolio_projects WHERE (id = ? AND version = ?) OR (id = ? AND version = ?)) = 2")
      .bind(project.id, other.position, project.position, Date.now(), project.id, other.id, project.id, project.version, other.id, other.version).run();
    if (result.meta.changes !== 2) throw new HttpError(409, "Порядок уже изменён. Обновите страницу.");
  } else if (data.published !== undefined) {
    if (data.published && (!project.desktopImage || !project.mobileImage)) throw new HttpError(400, "Добавьте оба скриншота перед публикацией.");
    const result = await database.prepare("UPDATE portfolio_projects SET published = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?")
      .bind(Number(data.published), Date.now(), project.id, project.version).run();
    if (!result.meta.changes) throw new HttpError(409, "Работа уже изменена. Обновите страницу.");
  }
  return json(await listProjects(true));
});
