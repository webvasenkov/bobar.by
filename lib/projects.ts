import { z } from "zod";
import { projects as originals } from "./content";
import { getDatabase } from "./database";
import { HttpError } from "./admin-http";
import type { Project } from "./project-types";

type ProjectRow = Omit<Project, "published" | "desktopImage" | "mobileImage"> & { published: number; desktop_image: string; mobile_image: string };
const convert = (row: ProjectRow): Project => ({ id: row.id, name: row.name, description: row.description, url: row.url,
  desktopImage: row.desktop_image, mobileImage: row.mobile_image, published: !!row.published, position: row.position, version: row.version });

/** Import the existing portfolio once, independently of schema migrations. */
async function seedProjects() {
  const database = getDatabase();
  if (await database.prepare("SELECT value FROM site_settings WHERE key = 'portfolio_seeded'").first()) return;
  await database.batch([
    ...originals.map((project, index) => database.prepare("INSERT INTO portfolio_projects (id, name, description, url, desktop_image, mobile_image, published, position, version, updated_at) VALUES (?, ?, ?, ?, ?, '', 1, ?, 1, ?) ON CONFLICT(id) DO NOTHING")
      .bind(`00000000-0000-4000-8000-00000000000${index + 1}`, project.name, project.description, project.url, project.image, index, Date.now())),
    database.prepare("INSERT INTO site_settings (key, value) VALUES ('portfolio_seeded', '1') ON CONFLICT(key) DO NOTHING"),
  ]);
}

export async function listProjects(includeHidden = false): Promise<Project[]> {
  await seedProjects();
  const rows = await getDatabase().prepare(`SELECT * FROM portfolio_projects ${includeHidden ? "" : "WHERE published = 1"} ORDER BY position, id`).all<ProjectRow>();
  return rows.results.map(convert);
}

const imagePath = z.string().max(200).refine(value => value === "" || /^\/media\/[0-9a-f-]{36}$/.test(value) || originals.some(project => project.image === value));
export const projectSchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(2).max(100), description: z.string().trim().min(5).max(350),
  url: z.string().trim().url().max(500).refine(value => { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; }),
  desktopImage: imagePath, mobileImage: imagePath, published: z.boolean(),
  position: z.number().int().min(0).max(10000), version: z.number().int().min(0),
});

export async function saveProject(body: unknown) {
  const parsed = projectSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "Проверьте название, описание, адрес сайта и скриншоты.");
  const project = parsed.data;
  const database = getDatabase();
  if (project.published && (!project.desktopImage || !project.mobileImage))
    throw new HttpError(400, "Для публикации добавьте скриншоты для компьютера и телефона.");
  for (const path of [project.desktopImage, project.mobileImage]) {
    if (path.startsWith("/media/") && !await database.prepare("SELECT id FROM portfolio_images WHERE id = ?").bind(path.slice(7)).first())
      throw new HttpError(400, "Изображение не найдено. Загрузите его ещё раз.");
  }
  const values = [project.name, project.description, project.url, project.desktopImage, project.mobileImage, Number(project.published), Date.now()];
  const result = project.version === 0
    ? await database.prepare("INSERT INTO portfolio_projects (name, description, url, desktop_image, mobile_image, published, updated_at, id, position, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM portfolio_projects), 1) ON CONFLICT(id) DO NOTHING").bind(...values, project.id).run()
    : await database.prepare("UPDATE portfolio_projects SET name = ?, description = ?, url = ?, desktop_image = ?, mobile_image = ?, published = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?").bind(...values, project.id, project.version).run();
  if (!result.meta.changes) throw new HttpError(409, "Работа уже изменена в другой вкладке. Обновите список и повторите правку.");
}
