#!/usr/bin/env python3
"""Generate a strong admin password; persist only its salted hash in .env."""
import argparse
import hashlib
import os
from pathlib import Path
import secrets
import tempfile


def create_credentials():
    password = secrets.token_urlsafe(24)
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000).hex()
    return "bobar", password, f"pbkdf2:100000:{salt.hex()}:{digest}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="Replace existing credentials and invalidate sessions")
    args = parser.parse_args()
    path = Path(__file__).resolve().parent.parent / ".env"
    original = path.read_text() if path.exists() else ""
    if any(line.startswith("ADMIN_PASSWORD_HASH=") and line.partition("=")[2].strip() for line in original.splitlines()) and not args.reset:
        raise SystemExit("Вход уже настроен. Для нового пароля запустите с --reset.")
    username, password, password_hash = create_credentials()
    lines = [line for line in original.splitlines() if not line.startswith(("ADMIN_USERNAME=", "ADMIN_PASSWORD_HASH="))]
    lines.extend([f"ADMIN_USERNAME={username}", f"ADMIN_PASSWORD_HASH={password_hash}"])
    descriptor, temporary = tempfile.mkstemp(prefix=".admin-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w") as output:
            output.write("\n".join(lines) + "\n")
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print(f"Логин: {username}\nПароль: {password}")
    print("Сохраните пароль. Затем выполните: docker compose up -d --no-deps --force-recreate app")


if __name__ == "__main__":
    main()
