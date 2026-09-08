import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const inquiries = sqliteTable(
  "inquiries",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    contact: text("contact").notNull(),
    message: text("message").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("idx_inquiries_created_at").on(table.createdAt)],
);

export const requestLimits = sqliteTable(
  "request_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(1),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("idx_request_limits_expires_at").on(table.expiresAt)],
);

export const portfolioProjects = sqliteTable("portfolio_projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  url: text("url").notNull(),
  desktopImage: text("desktop_image").notNull().default(""),
  mobileImage: text("mobile_image").notNull().default(""),
  published: integer("published").notNull().default(0),
  position: integer("position").notNull().default(0),
  version: integer("version").notNull().default(1),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("idx_portfolio_order").on(table.published, table.position)]);

export const portfolioImages = sqliteTable("portfolio_images", {
  id: text("id").primaryKey(),
  contentType: text("content_type").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const adminSessions = sqliteTable("admin_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  credentialHash: text("credential_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("idx_admin_session_expiry").on(table.expiresAt)]);

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
