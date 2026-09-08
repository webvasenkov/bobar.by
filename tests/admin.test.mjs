import assert from "node:assert/strict";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Miniflare } from "miniflare";

test("Cloudflare D1/R2 support admin login, screenshots, publication and reorder", async () => {
  const password = randomBytes(24).toString("base64url");
  const salt = randomBytes(16);
  const digest = pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  const runtime = new Miniflare({
    modules: true, scriptPath: "dist/server/index.js",
    modulesRules: [{ type: "ESModule", include: ["**/*.js"], fallthrough: true }],
    compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"], r2Buckets: ["BUCKET"],
    bindings: { ADMIN_USERNAME: "bobar", ADMIN_PASSWORD_HASH: `pbkdf2:100000:${salt.toString("hex")}:${digest}` },
  });
  let cookie = "";
  const origin = "https://bobar.test";
  const request = (path, method = "GET", body) => runtime.dispatchFetch(origin + path, {
    method, headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  try {
    const database = await runtime.getD1Database("DB");
    for (const file of ["0000_skinny_sersi.sql", "0001_cynical_black_cat.sql", "0002_big_adam_destine.sql"])
      for (const sql of (await readFile(`drizzle/${file}`, "utf8")).split("--> statement-breakpoint"))
        if (sql.trim()) await database.prepare(sql).run();
    assert.equal((await request("/api/admin/projects")).status, 401);
    const login = await request("/api/admin/session", "POST", { username: "bobar", password });
    assert.equal(login.status, 200);
    cookie = login.headers.get("set-cookie").split(";")[0];
    const projects = await (await request("/api/admin/projects")).json();
    assert.equal(projects.length, 3);
    const upload = await runtime.dispatchFetch(origin + "/api/admin/images", {
      method: "POST", headers: { Origin: origin, Cookie: cookie }, body: await readFile("public/projects/flowers.png"),
    });
    assert.equal(upload.status, 201);
    const { path } = await upload.json();
    assert.equal((await runtime.dispatchFetch(origin + path)).status, 404);
    const save = await request("/api/admin/projects", "PUT", { ...projects[0], mobileImage: path, mobileImages: [path] });
    assert.equal(save.status, 200);
    const updated = (await save.json())[0];
    assert.equal((await runtime.dispatchFetch(origin + path)).status, 200);
    const reorder = await request("/api/admin/projects", "PATCH", { id: updated.id, version: updated.version, direction: "down" });
    assert.equal(reorder.status, 200);
    assert.equal((await reorder.json())[1].id, updated.id);
    assert.ok((await (await runtime.dispatchFetch(origin)).text()).includes(path));
  } finally { await runtime.dispose(); }
});
