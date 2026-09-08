# BOBAR

Portfolio and inquiry site for an independent Belarusian developer.

## Architecture

- Next.js App Router conventions, React 19 and TypeScript, compiled for Cloudflare Workers with the starter's Vinext pipeline.
- Server-rendered page sections. Client components only for navigation, carousel, form and motion.
- Embla carousel supports touch and keyboard navigation, finite slides and reduced motion.
- React Hook Form and shared Zod schema validate inquiries on client and server.
- Prepared D1 statements persist inquiries. There is no public endpoint for reading personal data.
- Database schema and migrations live in `db/schema.ts` and `drizzle/`.
- Source screenshots remain unchanged in `public/projects/`. CSS crops the visible area.
- Brand geometry is maintained in `components/bobar/brand.tsx` and `public/favicon.svg`.

## Commands

Use Node 22.13 or newer and the committed npm lockfile.

- `npm run dev`: local development with the runtime wrapper.
- `npm run build`: verified production build.
- `npx tsc --noEmit`: strict type check.
- `npm run db:generate`: generate a migration after schema changes.

## Inquiries

`POST /api/inquiries` accepts name, contact, message, requestId (UUID) and an empty website honeypot. It requires a same-origin JSON request. A bounded request reader limits memory use. An atomic database counter allows five new submissions per IP per hour; only a rotating IP hash is persisted. Expired counters are deleted during successful submission. Request IDs prevent duplicates after network retries.

Inquiries can be inspected through the owner's Sites database controls. Telegram/email notifications are not configured. Configure a real delivery channel before public commercial launch if notifications are required; the site does not pretend to send them.

## Deployment

The private Sites preview is separate from bobar.by. Connect the domain and confirm public access deliberately before launch. SEO canonical, sitemap and metadata target bobar.by. There are no invented phone numbers, legal details or office addresses.

The layout targets 375, 768 and 1440px and uses viewport-height-aware project previews. On unusually short screens or with enlarged text, accessibility takes priority over forcing content into one screen.
