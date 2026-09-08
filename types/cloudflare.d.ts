/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BUCKET?: R2Bucket;
    ADMIN_USERNAME?: string;
    ADMIN_PASSWORD_HASH?: string;
    SITE_ORIGIN?: string;
    CLIENT_IP_HEADER?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
  }
}
