// Shrinks the category images already on disk to the size new uploads are
// stored at. Files are rewritten in place, so the paths in the DB stay valid.
//
//   node scripts/compress-category-images.mjs [dir]           dry run
//   node scripts/compress-category-images.mjs [dir] --apply   back up, then rewrite
//
// [dir] defaults to $CATEGORY_IMAGES_DIR.
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Keep in sync with src/lib/categoryImage.ts.
const MAX_WIDTH = 720;
const WEBP_QUALITY = 80;

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dir =
  args.find((arg) => !arg.startsWith('--')) ?? process.env.CATEGORY_IMAGES_DIR;

if (!dir || !fs.existsSync(dir)) {
  console.error(`Category image folder not found: ${dir}`);
  process.exit(1);
}

const backupDir = `${path.resolve(dir)}-backup-${new Date()
  .toISOString()
  .replace(/[:.]/g, '-')}`;
const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

/** Returns the WebP to write, or a reason the file is left alone. */
async function shrink(name, input) {
  const ext = path.extname(name).toLowerCase();
  // WebP bytes under a .png/.jpg name would be served with the wrong type.
  if (ext !== '' && ext !== '.webp') return { skip: `has a ${ext} extension` };

  const meta = await sharp(input)
    .metadata()
    .catch(() => null);
  if (meta == null) return { skip: 'not an image' };
  // Already done; re-encoding would only lose quality.
  if (meta.format === 'webp' && meta.width <= MAX_WIDTH) return { keep: true };

  const output = await sharp(input)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  return output.length < input.length ? { output } : { keep: true };
}

const totals = { files: 0, changed: 0, before: 0, after: 0 };
const names = fs
  .readdirSync(dir)
  .filter((name) => fs.statSync(path.join(dir, name)).isFile())
  .sort();

// Sequential on purpose: the VM has 4 GB and serves live traffic meanwhile.
// eslint-disable-next-line no-restricted-syntax
for (const name of names) {
  const file = path.join(dir, name);
  const input = fs.readFileSync(file);
  // eslint-disable-next-line no-await-in-loop
  const { skip, output } = await shrink(name, input);

  if (skip) {
    console.log(`skip ${name}: ${skip}`);
  } else {
    totals.files += 1;
    totals.before += input.length;
    totals.after += output?.length ?? input.length;
  }

  if (output) {
    totals.changed += 1;
    console.log(`${name}: ${kb(input.length)} -> ${kb(output.length)}`);
    if (apply) {
      fs.mkdirSync(backupDir, { recursive: true });
      fs.copyFileSync(file, path.join(backupDir, name));
      // Rename into place so nginx never serves a half-written file.
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, new Uint8Array(output));
      fs.chmodSync(tmp, fs.statSync(file).mode);
      fs.renameSync(tmp, file);
    }
  }
}

console.log(
  `\n${totals.changed} of ${totals.files} images ${
    apply ? 'rewritten' : 'would be rewritten'
  }: ${kb(totals.before)} -> ${kb(totals.after)}`,
);
if (!apply) console.log('Dry run. Re-run with --apply to write the files.');
else if (totals.changed > 0) console.log(`Originals saved in ${backupDir}`);
