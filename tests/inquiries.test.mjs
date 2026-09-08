import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Miniflare } from "miniflare";

// Exercise the actual compiled Worker and a local D1 database; never sends live leads.
test("inquiry API validates, persists once, rejects cross-origin and rate-limits", async () => {
  const notifications = [];
  const runtime = new Miniflare({
    bindings: { TELEGRAM_BOT_TOKEN: "test-token", TELEGRAM_CHAT_ID: "-100123" },
    outboundService: async (request) => {
      assert.equal(new URL(request.url).hostname, "api.telegram.org");
      notifications.push(await request.json());
      return Response.json({ ok: true });
    },
    modules: true,
    scriptPath: "dist/server/index.js",
    modulesRules: [
      { type: "ESModule", include: ["**/*.js"], fallthrough: true },
    ],
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"],
  });
  try {
    const database = await runtime.getD1Database("DB");
    for (const file of ["0000_skinny_sersi.sql", "0001_cynical_black_cat.sql"])
      for (const sql of (await readFile(`drizzle/${file}`, "utf8")).split("--> statement-breakpoint"))
        if (sql.trim()) await database.prepare(sql).run();
    const payload = {
      name: "Тест",
      contact: "@bobar_test",
      message: "Проверка формы заявки без реального клиента.",
      requestId: crypto.randomUUID(),
      website: "",
    };
    const send = (data = payload, origin = "https://bobar.test") =>
      runtime.dispatchFetch("https://bobar.test/api/inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          "CF-Connecting-IP": "192.0.2.10",
        },
        body: JSON.stringify(data),
      });
    assert.equal((await send(payload, "https://other.test")).status, 403);
    assert.equal((await send({ ...payload, contact: "invalid" })).status, 400);
    assert.equal((await send({ ...payload, website: "spam" })).status, 400);
    assert.equal((await send()).status, 201);
    assert.equal((await send()).status, 200);
    assert.equal(
      (
        await database
          .prepare("SELECT COUNT(*) AS count FROM inquiries")
          .first()
      ).count,
      1,
    );
    for (let index = 0; index < 4; index++)
      assert.equal(
        (await send({ ...payload, requestId: crypto.randomUUID() })).status,
        201,
      );
    assert.equal(
      (await send({ ...payload, requestId: crypto.randomUUID() })).status,
      429,
    );
    assert.equal(
      (
        await database
          .prepare("SELECT COUNT(*) AS count FROM inquiries")
          .first()
      ).count,
      5,
    );
    assert.equal(notifications.length, 5, "Retries must not duplicate Telegram messages");
    assert.ok(notifications.every((item) => item.chat_id === "-100123"));
    const page = await runtime.dispatchFetch("https://bobar.test/");
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /Мои работы/);
    assert.match(html, /Номер или @username/);
    assert.match(html, /<html lang="ru"/);
    assert.doesNotMatch(html, /Starter Project|codex-preview/);
    for (const path of ["/robots.txt", "/sitemap.xml"])
      assert.equal(
        (await runtime.dispatchFetch(`https://bobar.test${path}`)).status,
        200,
      );
  } finally {
    await runtime.dispose();
  }
});
