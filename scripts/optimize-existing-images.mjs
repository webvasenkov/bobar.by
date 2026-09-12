import { DatabaseSync, backup } from 'node:sqlite';
import { access, chmod, cp, mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { optimizeImage, OPTIMIZATION_VERSION } from '../deployment/image-optimizer.mjs';

export async function optimizeExistingImages({ databasePath, uploadsPath, apply = false, backupRoot }) {
  databasePath = resolve(databasePath);
  uploadsPath = resolve(uploadsPath);
  await access(databasePath); // Do not silently create an empty production database.
  const db = new DatabaseSync(databasePath, { readOnly: !apply });
  const report = { mode: apply ? 'apply' : 'dry-run', backup: null, beforeBytes: 0, afterBytes: 0, images: [], errors: [] };
  const lockPath = `${databasePath}.image-optimization.lock`;
  let lock;
  try {
    db.exec('PRAGMA busy_timeout=5000');
    const columns = db.prepare('PRAGMA table_info(portfolio_images)').all().map(row => row.name);
    if (!columns.includes('optimization_version')) throw new Error('Deploy the updated app and apply migration 0003 first.');
    if (apply) lock = await open(lockPath, 'wx', 0o600);
    const rows = db.prepare('SELECT * FROM portfolio_images WHERE optimization_version < ? ORDER BY created_at, id').all(OPTIMIZATION_VERSION);
    if (apply && rows.length) {
      const folder = join(resolve(backupRoot || join(dirname(databasePath), 'image-backups')), `${Date.now()}-${randomUUID()}`);
      await mkdir(folder, { recursive: true, mode: 0o700 });
      await backup(db, join(folder, 'bobar.sqlite'));
      await chmod(join(folder, 'bobar.sqlite'), 0o600);
      // Files are immutable: taking the SQLite snapshot first cannot miss a referenced upload.
      await cp(uploadsPath, join(folder, 'uploads'), { recursive: true, errorOnExist: true, force: false });
      report.backup = folder;
    }
    for (const row of rows) {
      let createdKey = null;
      try {
        const currentKey = row.storage_key || row.id;
        if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(currentKey)) throw new Error('Invalid image key');
        const original = await readFile(join(uploadsPath, currentKey));
        const result = await optimizeImage(original, row.content_type);
        let storageKey = row.storage_key;
        if (apply && result.bytes.length < original.length) {
          storageKey = randomUUID();
          const file = await open(join(uploadsPath, storageKey), 'wx', 0o600);
          createdKey = storageKey;
          try { await file.writeFile(result.bytes); await file.sync(); } finally { await file.close(); }
        }
        if (apply) {
          const changed = db.prepare('UPDATE portfolio_images SET content_type = ?, storage_key = ?, blur_data_url = ?, optimization_version = ? WHERE id = ? AND optimization_version = ? AND storage_key IS ? AND content_type = ?')
            .run(result.contentType, storageKey, result.blurDataURL, result.optimizationVersion,
              row.id, row.optimization_version, row.storage_key, row.content_type);
          if (!changed.changes) throw new Error('Image changed during processing; retry the migration');
          createdKey = null; // Database now points at a complete file; originals remain untouched.
        }
        report.beforeBytes += original.length;
        report.afterBytes += result.bytes.length;
        report.images.push({ id: row.id, beforeBytes: original.length, afterBytes: result.bytes.length });
      } catch (error) {
        if (createdKey) await unlink(join(uploadsPath, createdKey));
        report.errors.push({ id: row.id, message: String(error.message || error) });
      }
    }
    if (report.backup) await writeFile(join(report.backup, 'report.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
    return report;
  } finally {
    db.close();
    if (lock) { await lock.close(); await unlink(lockPath); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run')))
    throw new Error('Usage: node scripts/optimize-existing-images.mjs [--dry-run | --apply]');
  const report = await optimizeExistingImages({
    databasePath: process.env.DATABASE_PATH || 'data/bobar.sqlite',
    uploadsPath: process.env.UPLOADS_PATH || 'data/uploads',
    backupRoot: process.env.IMAGE_BACKUP_PATH,
    apply: args.includes('--apply'),
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) process.exitCode = 1;
}
