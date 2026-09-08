import type { Inquiry } from "./inquiry";

export interface TelegramConfig {
  token?: string;
  chatId?: string;
}

/** Plain text keeps client-supplied content from becoming Telegram markup. */
export function formatInquiry(inquiry: Inquiry, id: string): string {
  return [
    "Новая заявка · BOBAR",
    "",
    `Имя: ${inquiry.name}`,
    `Контакт: ${inquiry.contact}`,
    "",
    "О проекте:",
    inquiry.message,
    "",
    `Заявка: ${id}`,
  ].join("\n");
}

/** Database persistence is independent of Telegram availability. */
export async function notifyTelegram(
  inquiry: Inquiry,
  id: string,
  config: TelegramConfig,
  send: typeof fetch = fetch,
): Promise<boolean> {
  if (!config.token || !config.chatId) return false;
  try {
    const response = await send(
      `https://api.telegram.org/bot${config.token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: formatInquiry(inquiry, id),
          link_preview_options: { is_disabled: true },
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) return false;
    const result: unknown = await response.json();
    return typeof result === "object" && result !== null && "ok" in result && result.ok === true;
  } catch {
    // Never log fetch errors: they may contain the bot token in the URL.
    return false;
  }
}
