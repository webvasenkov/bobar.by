# Portfolio screenshot optimization

The VPS upload API uses Sharp 0.34.5 to try lossless WebP. It accepts a derivative only
when the file is smaller and the decoded RGBA hash is unchanged. Dimensions are not
reduced. JPEGs that are already smaller, high-bit-depth images, animations and rotated
photos keep their original bytes. A small inline WebP provides the gallery placeholder.
The portable Workers adapter leaves uploads unchanged; native optimization is VPS-only.

Original uploads remain under their original UUID. A separate immutable UUID stores the
optimized image. Database fields select the served file and its MIME type together.
Public URLs and project references do not change. Private browser caching revalidates
authorization on every use, returning 304 for an unchanged image. Unpublished media
still returns 404 before considering conditional headers.

## Deploy and process existing uploads

First inspect the actual VPS source and compare it with this branch; do not overwrite
uncommitted VPS changes. Back up the current code, SQLite database and uploads before
deploying. This change has not yet been installed or measured on the production VPS.

Build and start the updated app using the existing Compose project. The first request
applies the additive SQLite migration 0003. Keep a pre-deployment backup if rollback
to the previous app is needed: the old runtime rejects database schema version 4.

Preview the byte savings without changing files or rows:

```sh
docker compose exec -T app node scripts/optimize-existing-images.mjs --dry-run
```

Apply to uploaded images listed in `portfolio_images`:

```sh
docker compose exec -T app node scripts/optimize-existing-images.mjs --apply
```

The apply command first creates a consistent SQLite backup and copies the upload
directory into `/app/data/image-backups/`, then processes images one at a time. Allow
space for that backup and the new derivatives. Originals are kept. Missing/corrupt
files are reported individually and remain unchanged. Successful rows are versioned,
so a repeat run only processes unfinished rows. A lock prevents simultaneous apply runs.
An interrupted process may leave a lock; verify no migration is running before removing it.

Both modes return per-image and total byte counts. The apply backup also contains
`report.json`. The script does not modify project ordering, publication, captions,
gallery lists or the screenshots bundled under `public/projects/`.

## Verification

```sh
npm ci
npm run build:vps
node --test tests/image-optimization.test.mjs
node tests/admin-smoke.mjs
```

Tests use temporary databases and uploads, including pixel equality, a real compressed
PNG upload, authenticated media access, blur metadata in SSR, ETags, hiding cached
media, original preservation, backup restoration inputs and idempotent processing.
After deployment, check the gallery on desktop/mobile and a throttled connection,
then verify a real admin upload and record the production before/after totals.
