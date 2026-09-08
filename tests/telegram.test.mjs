import assert from "node:assert/strict";
import test from "node:test";
import { formatInquiry, notifyTelegram } from "../lib/telegram.ts";

const inquiry = { name: "Тест <b>", contact: "@bobar_test", message: "Тест заявки & без разметки" };
const config = { token: "test-token", chatId: "-100123" };

test("Telegram sends plain text to the configured destination", async () => {
  const delivered = await notifyTelegram(inquiry, "test-id", config, async (url, options) => {
    assert.equal(url, "https://api.telegram.org/bottest-token/sendMessage");
    const body = JSON.parse(options.body);
    assert.equal(body.chat_id, config.chatId);
    assert.equal(body.text, formatInquiry(inquiry, "test-id"));
    assert.equal(body.parse_mode, undefined);
    assert.match(body.text, /Тест <b>/);
    return Response.json({ ok: true });
  });
  assert.equal(delivered, true);
});

test("Telegram rejects HTTP and API errors without throwing or leaking secrets", async () => {
  for (const send of [
    async () => new Response("", { status: 403 }),
    async () => Response.json({ ok: false }),
    async () => { throw new Error("contains secret URL"); },
  ]) assert.equal(await notifyTelegram(inquiry, "id", config, send), false);
  assert.equal(await notifyTelegram(inquiry, "id", {}, async () => { assert.fail("Must not send without configuration"); }), false);
});

test("Maximum accepted input fits a Telegram message", () => {
  const text = formatInquiry({name: "я".repeat(80), contact: "@" + "a".repeat(31), message: "я".repeat(3000)}, "a".repeat(36));
  assert.ok(text.length < 4096);
});
