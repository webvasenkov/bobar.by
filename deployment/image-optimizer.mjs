import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';

export const OPTIMIZATION_VERSION = 1;
const options = { limitInputPixels: 40_000_000, failOn: 'error' };
let queue = Promise.resolve();

async function pixelHash(bytes) {
  const hash = createHash('sha256');
  await pipeline(sharp(bytes, options).ensureAlpha().raw(), hash);
  return hash.digest('hex');
}

async function processImage(input, contentType) {
  const original = Buffer.from(input);
  const source = sharp(original, options);
  const metadata = await source.metadata();
  if (!['png', 'jpeg', 'webp'].includes(metadata.format)) throw new Error('Unsupported image');
  const preview = await source.clone().rotate()
    .resize({ width: 24, height: 96, fit: 'inside', withoutEnlargement: true })
    .blur(0.5).webp({ quality: 35, effort: 3 }).toBuffer();
  let bytes = original;
  let type = contentType;
  // Preserve animation, high-bit-depth originals and rotated photographs as supplied.
  if ((metadata.pages ?? 1) === 1 && metadata.depth === 'uchar' &&
      (metadata.orientation ?? 1) === 1 && metadata.width <= 16383 && metadata.height <= 16383) {
    const candidate = await source.clone().keepMetadata()
      .webp({ lossless: true, effort: 6 }).timeout({ seconds: 30 }).toBuffer().catch(() => null);
    if (candidate && candidate.length < original.length) {
      // Verify decoded RGBA as well as using the lossless encoder. If color conversion
      // or transparent pixels change, retain the exact original instead.
      const before = await pixelHash(original);
      const after = await pixelHash(candidate);
      if (before === after) { bytes = candidate; type = 'image/webp'; }
    }
  }
  return { bytes, contentType: type, blurDataURL: `data:image/webp;base64,${preview.toString('base64')}`,
    optimizationVersion: OPTIMIZATION_VERSION };
}

/** Serial processing bounds native decoder memory when the admin selects several files. */
export function optimizeImage(bytes, contentType) {
  const work = queue.then(() => processImage(bytes, contentType));
  queue = work.then(() => undefined, () => undefined);
  return work;
}
