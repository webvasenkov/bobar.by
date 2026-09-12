ALTER TABLE portfolio_images ADD COLUMN storage_key text;
--> statement-breakpoint
ALTER TABLE portfolio_images ADD COLUMN blur_data_url text;
--> statement-breakpoint
ALTER TABLE portfolio_images ADD COLUMN optimization_version integer NOT NULL DEFAULT 0;
