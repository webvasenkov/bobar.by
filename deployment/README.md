# BOBAR на VPS

Подготовлено для bobar.by, Docker Compose и Caddy. Node.js 24 + Next.js standalone;
дизайн и компоненты общие с версией Sites. Только серверный runtime заменяется
при сборке. SQLite находится в постоянном Docker volume, не в Git.

## До запуска

1. Проверить существующие сайты: `docker ps`, `ss -lntup`, `systemctl status caddy`.
   Этот Compose занимает 80/443. Если они заняты, не останавливать существующий
   proxy: добавить BOBAR в его конфигурацию и использовать отдельный upstream.
2. В действующей DNS-зоне выставить A-запись `@` на `103.167.18.80`.
   Не менять MX/TXT и NS. Проверить существующую AAAA: она должна вести на этот
   сервер; неверную AAAA исправить до выпуска сертификата.
3. Открыть входящие TCP 80/443. UDP 443 нужен только для HTTP/3.
4. На сервере нужны Docker Engine, Compose v2 и Git. Проверить `docker compose version`.

## Установка (после загрузки исходников в GitHub)

```sh
git clone https://github.com/webvasenkov/bobar.by.git /opt/bobar
cd /opt/bobar
cp deployment/env.example .env
chmod 600 .env
# При необходимости заполнить Telegram-переменные в .env на сервере.
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 caddy
curl -I https://bobar.by
```

Никаких паролей сервера/хостинга в `.env` не требуется. Telegram не настроен
автоматически: без токена и chat ID заявки сохраняются, уведомления не отправляются.
Форма принимает Origin https://bobar.by. Caddy перезаписывает служебный заголовок
IP, приложение не публикует порт 3000 в интернет.

Caddy автоматически получает и продлевает HTTPS-сертификат и перенаправляет HTTP
на HTTPS. Данные сертификатов сохраняются в `caddy_data`. Если DNS ещё не указывает
на сервер или порты закрыты, выпуск сертификата не завершится.

## Обновление и откат

Перед обновлением записать текущий commit и сделать резервную копию SQLite.
Не выполнять `docker compose down -v`: это удалит заявки и сертификаты.

```sh
git rev-parse HEAD
git pull --ff-only
docker compose up -d --build
```

Для отката переключить исходники на записанный commit и повторить сборку.
Будущие изменения схемы БД требуют отдельного плана отката данных.

## Резервная копия

Создать согласованную копию внутри volume (имя не должно существовать):

```sh
docker compose exec app node -e 'const {DatabaseSync}=require("node:sqlite");const db=new DatabaseSync(process.env.DATABASE_PATH);db.exec("VACUUM INTO '\''/app/data/backup.sqlite'\''");db.close()'
mkdir -p backups
docker compose cp app:/app/data/backup.sqlite ./backups/backup.sqlite
```

Хранить копию вне сервера. Не копировать только основной файл живой WAL-базы.
Ранее сохранённые заявки Cloudflare D1 автоматически не переносятся.

## Проверки подготовки

`npm run build:vps` собирает отдельный серверный артефакт.
`node tests/vps-smoke.mjs` проверяет standalone-сборку без Telegram и реальных заявок.
Обычный `npm run build` по-прежнему предназначен для Sites/Cloudflare.

Docker, DNS и сертификат необходимо проверить непосредственно на VPS: из текущей
среды SSH недоступен. Сервер и DNS здесь не изменялись.

Документация:
- https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- https://nodejs.org/api/sqlite.html
- https://caddyserver.com/docs/automatic-https
