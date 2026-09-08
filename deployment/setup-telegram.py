#!/usr/bin/env python3
"""Configure Telegram on the VPS without putting a token in shell history."""

import getpass
import json
import os
from pathlib import Path
import re
import tempfile
import urllib.error
import urllib.request


def telegram(token, method, payload):
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            result = json.load(response)
    except (urllib.error.URLError, TimeoutError, ValueError):
        # Exceptions can contain the URL, including the token. Never print them.
        raise RuntimeError("Telegram недоступен или отклонил запрос. Проверьте токен и chat ID.") from None
    if not result.get("ok"):
        raise RuntimeError("Telegram отклонил запрос. Проверьте доступ бота к чату.")
    return result["result"]


def save_config(path, token, chat_id):
    original = path.read_text() if path.exists() else ""
    keys = {"TELEGRAM_BOT_TOKEN": token, "TELEGRAM_CHAT_ID": chat_id}
    lines = [line for line in original.splitlines()
             if not re.match(r"^\s*(?:export\s+)?TELEGRAM_(?:BOT_TOKEN|CHAT_ID)\s*=", line)]
    lines.extend(f"{key}={value}" for key, value in keys.items())
    # Atomic replacement retains every unrelated environment setting.
    descriptor, temporary = tempfile.mkstemp(prefix=".env-telegram-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w") as output:
            output.write("\n".join(lines) + "\n")
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    path = Path(__file__).resolve().parent.parent / ".env"
    if not os.isatty(0):
        raise RuntimeError("Запустите скрипт в интерактивном SSH-терминале.")
    token = getpass.getpass("Токен бота (ввод скрыт): ").strip()
    if not re.fullmatch(r"\d+:[A-Za-z0-9_-]+", token):
        raise RuntimeError("Неверный формат токена.")
    chat_id = input("Числовой chat ID получателя: ").strip()
    if not re.fullmatch(r"-?\d+", chat_id):
        raise RuntimeError("Нужен числовой chat ID, не @username.")
    bot = telegram(token, "getMe", {})
    chat = telegram(token, "getChat", {"chat_id": chat_id})
    recipient = chat.get("title") or " ".join(filter(None, [chat.get("first_name"), chat.get("last_name")]))
    print(f"Бот: @{bot['username']}. Получатель: {recipient} (ID {chat['id']}).")
    if input("Подключить этот чат и отправить тестовое уведомление? [y/N]: ").lower() != "y":
        print("Настройки не изменены.")
        return
    telegram(token, "sendMessage", {
        "chat_id": chat_id,
        "text": "BOBAR · Telegram подключён. Сюда будут приходить заявки с bobar.by после применения настроек на сервере.",
    })
    save_config(path, token, chat_id)
    print("Тест доставлен, .env сохранён. Примените: docker compose up -d --no-deps --force-recreate app")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError) as error:
        # OSError details are not needed and can reveal environment information.
        print(str(error) if isinstance(error, RuntimeError) else "Не удалось сохранить настройки .env.")
        raise SystemExit(1)
    except (KeyboardInterrupt, EOFError):
        print("\nНастройка отменена.")
        raise SystemExit(1)
