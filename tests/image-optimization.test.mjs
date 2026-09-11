import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import { optimizeImage } from '../deployment/image-optimizer.mjs';
import { optimizeExistingImages } from '../scripts/optimize-existing-images.mjs';

test('portfolio screenshots retain every decoded pixel and only get smaller', async () => {
  for (const name of ['flowers', 'cardan', 'transport']) {
    const source = await readFile(`public/projects/${name}.png`);
    const result = await optimizeImage(source, 'image/png');
    assert.ok(result.bytes.length <= source.length);
    const before = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const after = await sharp(result.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual(after, before);
    assert.match(result.blurDataURL, /^data:image\/webp;base64,/);
    assert.ok(result.blurDataURL.length < 3000);
    console.log(`${name}: ${source.length} -> ${result.bytes.length} bytes`);
  }
});

test('JPEG, transparency, orientation and invalid input are handled safely', async () => {
  const source = await readFile('public/projects/flowers.png');
  const jpeg = await sharp(source).jpeg({ quality: 60 }).toBuffer();
  const result = await optimizeImage(jpeg, 'image/jpeg');
  assert.ok(result.bytes.length <= jpeg.length);
  assert.deepEqual(await sharp(result.bytes).ensureAlpha().raw().toBuffer(), await sharp(jpeg).ensureAlpha().raw().toBuffer());
  const rotated = await sharp(source).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  assert.deepEqual((await optimizeImage(rotated, 'image/jpeg')).bytes, rotated);
  const alpha = await sharp({ create: { width: 20, height: 20, channels: 4, background: { r: 255, g: 70, b: 20, alpha: 0 } } }).png().toBuffer();
  const transparent = await optimizeImage(alpha, 'image/png');
  assert.deepEqual(await sharp(transparent.bytes).ensureAlpha().raw().toBuffer(), await sharp(alpha).ensureAlpha().raw().toBuffer());
  await assert.rejects(optimizeImage(Buffer.from('not an image'), 'image/png'));
  // A failed job must not poison the serial processing queue.
  assert.ok((await optimizeImage(source, 'image/png')).blurDataURL);
});

test('existing images: dry-run, backup, atomic replacement, missing files and repeat runs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bobar-images-'));
  const databasePath = join(root, 'bobar.sqlite');
  const uploadsPath = join(root, 'uploads');
  await mkdir(uploadsPath);
  const db = new DatabaseSync(databasePath);
  try {
    for (const file of ['0000_skinny_sersi.sql', '0001_cynical_black_cat.sql', '0002_big_adam_destine.sql', '0003_image_optimization.sql'])
      db.exec(await readFile(`drizzle/${file}`, 'utf8'));
    const original = await sharp(await readFile('public/projects/flowers.png')).png({ compressionLevel: 0 }).toBuffer();
    const id = randomUUID();
    const missing = randomUUID();
    const insert = db.prepare('INSERT INTO portfolio_images (id, content_type, width, height, created_at) VALUES (?, ?, ?, ?, ?)');
    insert.run(id, 'image/png', 1440, 900, Date.now());
    insert.run(missing, 'image/png', 1440, 900, Date.now());
    await writeFile(join(uploadsPath, id), original);
    const projectId = randomUUID();
    db.prepare("INSERT INTO portfolio_projects (id,name,description,url,desktop_image,mobile_image,published,position,version,updated_at) VALUES (?,'Test','A test project','https://example.com',?, ?,1,0,1,0)")
      .run(projectId, `/media/${id}`, `/media/${id}`);
    const config = { databasePath, uploadsPath };
    const dry = await optimizeExistingImages(config);
    assert.equal(dry.mode, 'dry-run'); assert.equal(dry.backup, null);
    assert.equal(db.prepare('SELECT optimization_version FROM portfolio_images WHERE id=?').get(id).optimization_version, 0);
    assert.deepEqual(await readdir(uploadsPath), [id]);
    const applied = await optimizeExistingImages({ ...config, apply: true });
    assert.equal(applied.errors.length, 1); assert.equal(applied.errors[0].id, missing);
    assert.ok(applied.backup);
    const row = db.prepare('SELECT * FROM portfolio_images WHERE id=?').get(id);
    assert.equal(row.optimization_version, 1); assert.ok(row.storage_key); assert.ok(row.blur_data_url);
    assert.deepEqual(await readFile(join(uploadsPath, id)), original);
    assert.deepEqual(await readFile(join(applied.backup, 'uploads', id)), original);
    assert.ok((await readFile(join(uploadsPath, row.storage_key))).length < original.length);
    const snapshot = new DatabaseSync(join(applied.backup, 'bobar.sqlite'), { readOnly: true });
    assert.equal(snapshot.prepare('SELECT storage_key FROM portfolio_images WHERE id=?').get(id).storage_key, null);
    snapshot.close();
    assert.equal(db.prepare('SELECT desktop_image FROM portfolio_projects WHERE id=?').get(projectId).desktop_image, `/media/${id}`);
    db.prepare('DELETE FROM portfolio_images WHERE id=?').run(missing);
    const again = await optimizeExistingImages({ ...config, apply: true });
    assert.equal(again.images.length, 0); assert.equal(again.backup, null);
    assert.equal(db.prepare('SELECT storage_key FROM portfolio_images WHERE id=?').get(id).storage_key, row.storage_key);
  } finally { db.close(); await rm(root, { recursive: true, force: true }); }
});
