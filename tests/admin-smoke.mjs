import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import sharp from "sharp";

// Real HTTP against the production server, with temporary data and no notifications.
const root = resolve(".next/standalone");
const temp = await mkdtemp(join(tmpdir(), "bobar-admin-"));
const databasePath = join(temp, "bobar.sqlite");
const base = "http://127.0.0.1:3138";
const origin = "https://bobar.by";
const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16);
const digest = pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
const passwordHash = `pbkdf2:100000:${salt.toString("hex")}:${digest}`;
await cp("public", join(root, "public"), { recursive: true });
await mkdir(join(root, ".next/static"), { recursive: true });
await cp(".next/static", join(root, ".next/static"), { recursive: true });
await cp("drizzle", join(root, "drizzle"), { recursive: true });
const legacy = new DatabaseSync(databasePath);
legacy.exec(await readFile("drizzle/0000_skinny_sersi.sql", "utf8"));
legacy.exec("PRAGMA user_version=1");
legacy.prepare("INSERT INTO inquiries VALUES (?, ?, ?, ?, ?)").run("legacy-inquiry", "Тест", "@test", "Заявка до обновления", Date.now());
legacy.close();

let server;
let output = "";
let cookie = "";
const start = async (hash = passwordHash) => {
  server = spawn(process.execPath, [join(root, "server.js")], { cwd: root,
    env: { ...process.env, NODE_ENV: "production", PORT: "3138", HOSTNAME: "127.0.0.1", SITE_ORIGIN: origin,
      DATABASE_PATH: databasePath, UPLOADS_PATH: join(temp, "uploads"), ADMIN_USERNAME: "bobar", ADMIN_PASSWORD_HASH: hash,
      TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: "" }, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", data => output += data);
  server.stderr.on("data", data => output += data);
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error(output);
    try { if ((await fetch(base)).ok) return; } catch {}
    await delay(100);
  }
  throw new Error(output);
};
const stop = async () => {
  if (!server || server.exitCode !== null) return;
  await new Promise(resolve => { server.once("exit", resolve); server.kill("SIGTERM"); });
};
const request = (path, method = "GET", body, options = {}) => fetch(base + path, {
  method, headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json", "X-Bobar-Client-IP": "192.0.2.30", ...options },
  ...(body !== undefined && { body: JSON.stringify(body) }),
});
const list = async () => { const response = await request("/api/admin/projects"); assert.equal(response.status, 200); return response.json(); };
const publish = project => request("/api/admin/projects", "PATCH", { id: project.id, version: project.version, published: true });
const login = async () => {
  const response = await request("/api/admin/session", "POST", { username: "bobar", password });
  assert.equal(response.status, 200);
  const header = response.headers.get("set-cookie");
  assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Strict/); assert.match(header, /Secure/);
  cookie = header.split(";")[0];
};
try {
  await start();
  assert.equal((await request("/admin")).status, 200);
  for (const path of ["/api/admin/session", "/api/admin/projects"])
    assert.equal((await request(path)).status, 401);
  assert.equal((await request("/api/admin/projects", "PUT", {})).status, 401);
  assert.equal((await request("/api/admin/projects", "PATCH", {})).status, 401);
  assert.equal((await request("/api/admin/images", "POST", {})).status, 401);
  assert.equal((await request("/api/admin/session", "POST", {}, { Origin: "https://untrusted.test" })).status, 403);
  assert.equal((await request("/api/admin/session", "POST", { username: "bobar", password: "wrong" })).status, 401);
  await login();
  assert.equal((await list()).length, 3, "Initial projects imported exactly once");
  const upload = async bytes => fetch(base + "/api/admin/images", { method: "POST", headers: { Origin: origin, Cookie: cookie, "Content-Type": "image/png" }, body: bytes });
  assert.equal((await upload(Buffer.from('<svg width="10" height="10" xmlns="http://www.w3.org/2000/svg"></svg>'))).status, 415);
  assert.equal((await upload(Buffer.alloc(8 * 1024 * 1024 + 1))).status, 413);
  const bytes = await readFile("public/projects/flowers.png");
  const png = await sharp(bytes).png({ compressionLevel: 0 }).toBuffer();
  const compressedResponse = await upload(png);
  assert.equal(compressedResponse.status, 201);
  const compressed = await compressedResponse.json();
  assert.ok(compressed.optimizedBytes < compressed.originalBytes);
  const compressedMedia = await request(compressed.path);
  assert.equal(compressedMedia.headers.get("content-type"), "image/webp");
  assert.deepEqual(await sharp(Buffer.from(await compressedMedia.arrayBuffer())).ensureAlpha().raw().toBuffer(),
    await sharp(png).ensureAlpha().raw().toBuffer());
  assert.deepEqual(await readFile(join(temp, "uploads", compressed.path.slice(7))), png, "Uploaded original is retained");
  const screens = [];
  for (let i = 0; i < 4; i++) {
    const response = await upload(bytes); assert.equal(response.status, 201);
    const image = await response.json();
    assert.ok(image.optimizedBytes <= image.originalBytes);
    assert.match(image.blurDataURL, /^data:image\/webp;base64,/);
    screens.push(image.path);
  }
  assert.equal((await fetch(base + screens[0])).status, 404, "Unpublished uploads stay private");
  assert.equal((await request(screens[0])).status, 200);
  let project = { id: randomUUID(), name: "Тестовая работа", description: "Проверка управления портфолио", url: "https://example.com",
    desktopImage: screens[0], mobileImage: "", published: false, position: 0, version: 0 };
  assert.equal((await request("/api/admin/projects", "PUT", { ...project, url: "javascript:alert(1)" })).status, 400);
  assert.equal((await request("/api/admin/projects", "PUT", { ...project, published: true })).status, 400);
  assert.equal((await request("/api/admin/projects", "PUT", project)).status, 200);
  assert.equal((await request("/api/admin/projects", "PUT", project)).status, 409, "Duplicate retry is not a second project");
  let projects = await list();
  project = projects.find(item => item.id === project.id);
  assert.equal(project.position, 3, "Server assigns the next position");
  assert.equal((await publish(project)).status, 400, "Both screenshots required before publication");
  assert.equal((await (await request("/api/projects")).json()).length, 3);
  assert.equal((await request("/api/admin/projects", "PUT", { ...project, mobileImage: screens[1], desktopImages: [screens[0], screens[2]], mobileImages: [screens[1], screens[3]], published: true })).status, 200);
  assert.equal((await request("/api/admin/projects", "PUT", project)).status, 409, "Stale edits cannot overwrite newer data");
  projects = await list(); project = projects.find(item => item.id === project.id);
  assert.equal((await (await request("/api/projects")).json()).length, 4);
  assert.deepEqual(project.desktopImages, [screens[0], screens[2]]);
  assert.deepEqual(project.mobileImages, [screens[1], screens[3]]);
  assert.equal((await fetch(base + screens[2])).status, 200, "Additional gallery screenshots are public");
  assert.match(project.imagePlaceholders[screens[2]], /^data:image\/webp;base64,/);
  const media = await fetch(base + screens[2]);
  const etag = media.headers.get("etag");
  assert.ok(etag);
  assert.equal(media.headers.get("cache-control"), "private, no-cache");
  assert.equal((await fetch(base + screens[2], { headers: { "If-None-Match": etag } })).status, 304);
  assert.match(await (await fetch(base)).text(), /--desktop-blur/);
  assert.equal((await request("/api/admin/projects", "PUT", { ...project, desktopImages: Array(9).fill(screens[0]) })).status, 400);
  assert.equal((await request("/api/admin/projects", "PUT", { ...project, mobileImages: [] })).status, 400, "Published work must retain a mobile screenshot");
  assert.equal((await request("/api/admin/projects", "PUT", { ...project, desktopImages: [screens[2]], mobileImages: [screens[1]] })).status, 200);
  project = (await list()).find(item => item.id === project.id);
  assert.equal(project.desktopImage, screens[2], "Removing the cover promotes the next image");
  assert.equal((await fetch(base + screens[0])).status, 404, "Removed screenshot no longer public");
  assert.equal((await fetch(base + screens[3])).status, 404, "Removed mobile screenshot no longer public");
  assert.equal((await request("/api/admin/projects", "PUT", { ...project, desktopImages: [screens[0], screens[2]] })).status, 200);
  project = (await list()).find(item => item.id === project.id);
  const html = await (await fetch(base)).text();
  assert.match(html, /Тестовая работа/); assert.ok(html.includes(screens[1]), "Mobile source is rendered without rebuild");
  const image = await fetch(base + screens[0]);
  assert.equal(image.status, 200); assert.equal(image.headers.get("content-type"), "image/jpeg", "Content is detected from bytes, not the filename or request header");
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes);
  assert.equal((await request("/api/admin/projects", "PATCH", { id: project.id, version: project.version, direction: "up" })).status, 200);
  projects = await list(); assert.equal(projects[2].id, project.id, "Reordering moves the project"); project = projects[2];
  await stop(); await start();
  assert.equal((await list())[2].id, project.id, "Order and session survive server restart");
  assert.equal((await fetch(base + screens[0])).status, 200, "Uploads survive restart");
  assert.equal((await request("/api/admin/projects", "PATCH", { id: project.id, version: project.version, published: false })).status, 200);
  assert.equal((await fetch(base + screens[0])).status, 404, "Hidden screenshot no longer public");
  assert.equal((await fetch(base + screens[2], { headers: { "If-None-Match": etag } })).status, 404,
    "A cached screenshot cannot bypass unpublishing");
  assert.equal((await request("/api/admin/session", "DELETE")).status, 200);
  assert.equal((await request("/api/admin/projects")).status, 401, "Logout invalidates session on server");
  await login();
  const db = new DatabaseSync(databasePath);
  assert.equal(db.prepare("PRAGMA user_version").get().user_version, 4);
  assert.equal(db.prepare("SELECT name FROM inquiries WHERE id = 'legacy-inquiry'").get().name, "Тест");
  db.prepare("UPDATE admin_sessions SET expires_at = 1").run();
  assert.equal((await request("/api/admin/session")).status, 401, "Expired sessions rejected");
  db.close(); await login();
  await stop(); await start(passwordHash.replace(/.$/, passwordHash.endsWith("0") ? "1" : "0"));
  assert.equal((await request("/api/admin/session")).status, 401, "Password change invalidates old sessions");
  for (let i = 0; i < 8; i++) assert.equal((await request("/api/admin/session", "POST", { username: "bobar", password: "wrong" }, { "X-Bobar-Client-IP": "192.0.2.40" })).status, 401);
  assert.equal((await request("/api/admin/session", "POST", { username: "bobar", password: "wrong" }, { "X-Bobar-Client-IP": "192.0.2.40" })).status, 429);
  console.log("PASS: auth, CSRF, rate limit, image validation/privacy, CRUD, responsive sources, optimistic locking, ordering, migration, persistence, logout, expiration and credential rotation.");
} finally {
  await stop(); await rm(temp, { recursive: true, force: true });
}
